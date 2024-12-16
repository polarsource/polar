import math

import stripe as stripe_lib
from sqlalchemy import select

from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession

from .balance import balance_transaction as balance_transaction_service
from .base import BaseTransactionService, BaseTransactionServiceError
from .processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class RefundTransactionError(BaseTransactionServiceError): ...


class RefundUnknownPaymentTransaction(RefundTransactionError):
    def __init__(self, charge_id: str) -> None:
        self.charge_id = charge_id
        message = (
            f"Refund issued for charge {charge_id}, "
            "but the payment transaction is unknown."
        )
        super().__init__(message)


class RefundTransactionService(BaseTransactionService):
    async def create_refunds(
        self, session: AsyncSession, *, charge: stripe_lib.Charge
    ) -> list[Transaction]:
        payment_transaction = await self.get_by(session, charge_id=charge.id)
        if payment_transaction is None:
            raise RefundUnknownPaymentTransaction(charge.id)

        # Get all the refunds for this charge
        refunds = await stripe_service.list_refunds(charge=charge.id)

        refund_transactions: list[Transaction] = []
        # Handle each individual refund
        async for refund in refunds:
            if refund.status != "succeeded":
                continue

            # Already handled that refund before
            refund_transaction = await self.get_by(
                session, type=TransactionType.refund, refund_id=refund.id
            )
            if refund_transaction is not None:
                continue

            refund_amount = refund.amount
            total_amount = payment_transaction.amount + payment_transaction.tax_amount
            tax_refund_amount = abs(
                int(
                    math.floor(payment_transaction.tax_amount * refund_amount)
                    / total_amount
                )
            )

            refund_transaction = Transaction(
                type=TransactionType.refund,
                processor=PaymentProcessor.stripe,
                currency=refund.currency,
                amount=-refund.amount + tax_refund_amount,
                account_currency=refund.currency,
                account_amount=-refund.amount + tax_refund_amount,
                tax_amount=-tax_refund_amount,
                tax_country=payment_transaction.tax_country,
                tax_state=payment_transaction.tax_state,
                customer_id=payment_transaction.customer_id,
                charge_id=charge.id,
                refund_id=refund.id,
                payment_customer_id=payment_transaction.payment_customer_id,
                payment_organization_id=payment_transaction.payment_organization_id,
                payment_user_id=payment_transaction.payment_user_id,
                pledge_id=payment_transaction.pledge_id,
                issue_reward_id=payment_transaction.issue_reward_id,
                order_id=payment_transaction.order_id,
            )

            # Compute and link fees
            transaction_fees = (
                await processor_fee_transaction_service.create_refund_fees(
                    session, refund_transaction=refund_transaction
                )
            )
            refund_transaction.incurred_transactions = transaction_fees

            session.add(refund_transaction)
            refund_transactions.append(refund_transaction)

            # Create reversal balances if it was already balanced
            await self._create_reversal_balances(
                session,
                payment_transaction=payment_transaction,
                refund_amount=refund_amount,
            )

        await session.flush()

        return refund_transactions

    async def create_reversal_balances_for_payment(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> list[tuple[Transaction, Transaction]]:
        """
        Create reversal balances for a refunded payment transaction.

        Mostly useful when releasing held balances: if a payment transaction has
        been refunded before the Account creation, we need to create the reversal
        balances so the refund is correctly accounted for.
        """
        statement = select(Transaction).where(
            Transaction.type == TransactionType.refund,
            Transaction.charge_id == payment_transaction.charge_id,
        )

        result = await session.execute(statement)
        refunds = result.scalars().all()

        reversal_balances: list[tuple[Transaction, Transaction]] = []
        for refund in refunds:
            reversal_balances += await self._create_reversal_balances(
                session,
                payment_transaction=payment_transaction,
                refund_amount=refund.amount,
            )

        return reversal_balances

    async def _create_reversal_balances(
        self,
        session: AsyncSession,
        *,
        payment_transaction: Transaction,
        refund_amount: int,
    ) -> list[tuple[Transaction, Transaction]]:
        total_amount = payment_transaction.amount + payment_transaction.tax_amount

        reversal_balances: list[tuple[Transaction, Transaction]] = []
        balance_transactions_couples = await self._get_balance_transactions_for_payment(
            session, payment_transaction=payment_transaction
        )
        for balance_transactions_couple in balance_transactions_couples:
            outgoing, _ = balance_transactions_couple
            # Refund each balance proportionally
            balance_refund_amount = abs(
                int(math.floor(outgoing.amount * refund_amount) / total_amount)
            )
            reversal_balances.append(
                await balance_transaction_service.create_reversal_balance(
                    session,
                    balance_transactions=balance_transactions_couple,
                    amount=balance_refund_amount,
                )
            )
        return reversal_balances


refund_transaction = RefundTransactionService(Transaction)
