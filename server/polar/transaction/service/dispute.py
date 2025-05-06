import math

import stripe as stripe_lib
from sqlalchemy import select

from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Transaction
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession

from .balance import balance_transaction as balance_transaction_service
from .base import BaseTransactionService, BaseTransactionServiceError
from .platform_fee import platform_fee_transaction as platform_fee_transaction_service
from .processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class DisputeTransactionError(BaseTransactionServiceError): ...


class DisputeClosed(DisputeTransactionError):
    def __init__(self, dispute_id: str) -> None:
        self.dispute_id = dispute_id
        message = f"Dispute {dispute_id} is closed."
        super().__init__(message)


class DisputeNotResolved(DisputeTransactionError):
    def __init__(self, dispute_id: str) -> None:
        self.dispute_id = dispute_id
        message = f"Dispute {dispute_id} is not resolved."
        super().__init__(message)


class DisputeUnknownPaymentTransaction(DisputeTransactionError):
    def __init__(self, dispute_id: str, charge_id: str) -> None:
        self.dispute_id = dispute_id
        self.charge_id = charge_id
        message = (
            f"Dispute {dispute_id} created for charge {charge_id}, "
            "but the payment transaction is unknown."
        )
        super().__init__(message)


class DisputeTransactionService(BaseTransactionService):
    async def create_dispute(
        self, session: AsyncSession, *, dispute: stripe_lib.Dispute
    ) -> tuple[Transaction, Transaction | None]:
        if dispute.status in {"warning_closed"}:
            raise DisputeClosed(dispute.id)

        if dispute.status not in {"won", "lost"}:
            raise DisputeNotResolved(dispute.id)

        charge_id: str = get_expandable_id(dispute.charge)
        payment_transaction = await self.get_by(
            session, type=TransactionType.payment, charge_id=charge_id
        )
        if payment_transaction is None:
            raise DisputeUnknownPaymentTransaction(dispute.id, charge_id)

        dispute_amount = dispute.amount
        total_amount = payment_transaction.amount + payment_transaction.tax_amount
        tax_refund_amount = abs(
            int(
                math.floor(payment_transaction.tax_amount * dispute_amount)
                / total_amount
            )
        )

        # Create the dispute, i.e. the transaction withdrawing the amount
        dispute_transaction = Transaction(
            type=TransactionType.dispute,
            processor=Processor.stripe,
            currency=dispute.currency,
            amount=-dispute.amount + tax_refund_amount,
            account_currency=dispute.currency,
            account_amount=-dispute.amount + tax_refund_amount,
            tax_amount=-tax_refund_amount,
            tax_country=payment_transaction.tax_country,
            tax_state=payment_transaction.tax_state,
            customer_id=payment_transaction.customer_id,
            charge_id=charge_id,
            dispute_id=dispute.id,
            payment_customer_id=payment_transaction.payment_customer_id,
            payment_organization_id=payment_transaction.payment_organization_id,
            payment_user_id=payment_transaction.payment_user_id,
            pledge_id=payment_transaction.pledge_id,
            issue_reward_id=payment_transaction.issue_reward_id,
            order_id=payment_transaction.order_id,
            incurred_transactions=[],
        )
        session.add(dispute_transaction)
        dispute_fees = await processor_fee_transaction_service.create_dispute_fees(
            session, dispute_transaction=dispute_transaction, category="dispute"
        )
        dispute_transaction.incurred_transactions = dispute_fees

        # We won 😃 Create the dispute reversal, i.e. the transaction reinstating the amount
        dispute_reversal_transaction: Transaction | None = None
        if dispute.status == "won":
            dispute_reversal_transaction = Transaction(
                type=TransactionType.dispute_reversal,
                processor=Processor.stripe,
                currency=dispute.currency,
                amount=dispute.amount - tax_refund_amount,
                account_currency=dispute.currency,
                account_amount=dispute.amount - tax_refund_amount,
                tax_amount=tax_refund_amount,
                tax_country=payment_transaction.tax_country,
                tax_state=payment_transaction.tax_state,
                customer_id=payment_transaction.customer_id,
                charge_id=charge_id,
                dispute_id=dispute.id,
                payment_customer_id=payment_transaction.payment_customer_id,
                payment_organization_id=payment_transaction.payment_organization_id,
                payment_user_id=payment_transaction.payment_user_id,
                pledge_id=payment_transaction.pledge_id,
                issue_reward_id=payment_transaction.issue_reward_id,
                order_id=payment_transaction.order_id,
                incurred_transactions=[],
            )
            session.add(dispute_reversal_transaction)
            dispute_reversal_fees = (
                await processor_fee_transaction_service.create_dispute_fees(
                    session,
                    dispute_transaction=dispute_reversal_transaction,
                    category="dispute_reversal",
                )
            )
            dispute_reversal_transaction.incurred_transactions = dispute_reversal_fees
        # We lost 😢 Reverse the balances on the organization's account if it was already balanced
        elif dispute.status == "lost":
            await self._create_reversal_balances(
                session,
                payment_transaction=payment_transaction,
                dispute_amount=dispute_amount,
            )

        # Balance the (crazy high) dispute fees on the organization's account
        all_fees = dispute_fees
        if dispute_reversal_transaction is not None:
            all_fees += dispute_reversal_fees
        await self._create_dispute_fees_balances(
            session, payment_transaction=payment_transaction, dispute_fees=all_fees
        )

        await session.flush()

        return dispute_transaction, dispute_reversal_transaction

    async def create_reversal_balances_for_payment(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> list[tuple[Transaction, Transaction]]:
        """
        Create reversal balances for a disputed payment transaction.

        Mostly useful when releasing held balances: if a payment transaction has
        been disputed before the Account creation, we need to create the reversal
        balances so the refund is correctly accounted for.
        """
        statement = select(Transaction).where(
            Transaction.type == TransactionType.dispute,
            Transaction.charge_id == payment_transaction.charge_id,
        )
        result = await session.execute(statement)
        disputes = result.scalars().all()

        reversal_balances: list[tuple[Transaction, Transaction]] = []
        for dispute in disputes:
            # Skip if there is a dispute reversal: the operations are neutral
            dispute_reversal = await self.get_by(
                session,
                type=TransactionType.dispute_reversal,
                dispute_id=dispute.dispute_id,
            )
            if dispute_reversal is not None:
                continue

            reversal_balances += await self._create_reversal_balances(
                session,
                payment_transaction=payment_transaction,
                dispute_amount=dispute.amount,
            )

        return reversal_balances

    async def _create_reversal_balances(
        self,
        session: AsyncSession,
        *,
        payment_transaction: Transaction,
        dispute_amount: int,
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
                int(math.floor(outgoing.amount * dispute_amount) / total_amount)
            )
            reversal_balances.append(
                await balance_transaction_service.create_reversal_balance(
                    session,
                    balance_transactions=balance_transactions_couple,
                    amount=balance_refund_amount,
                )
            )

        return reversal_balances

    async def _create_dispute_fees_balances(
        self,
        session: AsyncSession,
        *,
        payment_transaction: Transaction,
        dispute_fees: list[Transaction],
    ) -> list[tuple[Transaction, Transaction]]:
        balance_transactions_couples = await self._get_balance_transactions_for_payment(
            session, payment_transaction=payment_transaction
        )
        return await platform_fee_transaction_service.create_dispute_fees_balances(
            session,
            dispute_fees=dispute_fees,
            balance_transactions=balance_transactions_couples[0],
        )


dispute_transaction = DisputeTransactionService(Transaction)
