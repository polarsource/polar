import math
from collections.abc import Sequence

from sqlalchemy import select

from polar.models import Refund, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession

from .balance import balance_transaction as balance_transaction_service
from .base import BaseTransactionService, BaseTransactionServiceError
from .processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class RefundTransactionError(BaseTransactionServiceError): ...


class RefundTransactionService(BaseTransactionService):
    async def get_by_charge_id(
        self, session: AsyncSession, charge_id: str
    ) -> Sequence[Transaction]:
        statement = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.refund,
                Transaction.charge_id == charge_id,
            )
            .order_by(Transaction.created_at.asc())
        )
        result = await session.execute(statement)
        refunds = result.scalars().all()
        return refunds

    async def get_by_stripe_refund_id(
        self, session: AsyncSession, refund_id: str
    ) -> Transaction | None:
        statement = select(Transaction).where(
            Transaction.type == TransactionType.refund,
            Transaction.refund_id == refund_id,
        )
        result = await session.execute(statement)
        refund = result.scalars().one_or_none()
        return refund

    async def create(
        self,
        session: AsyncSession,
        *,
        charge_id: str,
        payment_transaction: Transaction,
        refund: Refund,
    ) -> Transaction | None:
        if not refund.succeeded:
            return None

        existing = await self.get_by_stripe_refund_id(session, refund.stripe_id)
        if existing:
            return None

        refund_transaction = Transaction(
            type=TransactionType.refund,
            processor=PaymentProcessor.stripe,
            currency=refund.currency,
            amount=-refund.amount + refund.tax_amount,
            account_currency=refund.currency,
            account_amount=-refund.amount + refund.tax_amount,
            tax_amount=-refund.tax_amount,
            tax_country=payment_transaction.tax_country,
            tax_state=payment_transaction.tax_state,
            customer_id=payment_transaction.customer_id,
            charge_id=charge_id,
            refund_id=refund.stripe_id,
            payment_customer_id=payment_transaction.payment_customer_id,
            payment_organization_id=payment_transaction.payment_organization_id,
            payment_user_id=payment_transaction.payment_user_id,
            pledge_id=payment_transaction.pledge_id,
            issue_reward_id=payment_transaction.issue_reward_id,
            order_id=payment_transaction.order_id,
        )

        # Compute and link fees
        transaction_fees = await processor_fee_transaction_service.create_refund_fees(
            session, refund_transaction=refund_transaction
        )
        refund_transaction.incurred_transactions = transaction_fees

        session.add(refund_transaction)

        # Create reversal balances if it was already balanced
        await self._create_reversal_balances(
            session,
            payment_transaction=payment_transaction,
            refund_amount=refund.amount,
        )
        return refund_transaction

    async def create_many(
        self,
        session: AsyncSession,
        *,
        charge_id: str,
        payment_transaction: Transaction,
        refunds: list[Refund],
    ) -> list[Transaction]:
        ret = []
        for refund in refunds:
            refund_transaction = await self.create(
                session,
                charge_id=charge_id,
                payment_transaction=payment_transaction,
                refund=refund,
            )
            if refund_transaction is not None:
                ret.append(refund_transaction)

        return ret

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
