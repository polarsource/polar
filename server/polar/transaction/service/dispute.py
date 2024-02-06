import itertools
import math

import stripe as stripe_lib
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession

from .base import BaseTransactionService, BaseTransactionServiceError
from .transfer import transfer_transaction as transfer_transaction_service


class DisputeTransactionError(BaseTransactionServiceError):
    ...


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
    ) -> Transaction:
        charge_id: str = get_expandable_id(dispute.charge)
        payment_transaction = await self.get_by(
            session, type=TransactionType.payment, charge_id=charge_id
        )
        if payment_transaction is None:
            raise DisputeUnknownPaymentTransaction(dispute.id, charge_id)

        balance_transaction = next(
            bt
            for bt in dispute.balance_transactions
            if bt.reporting_category == "dispute"
        )

        dispute_amount = dispute.amount
        total_amount = payment_transaction.amount + payment_transaction.tax_amount
        tax_refund_amount = abs(
            int(
                math.floor(payment_transaction.tax_amount * dispute_amount)
                / total_amount
            )
        )

        dispute_transaction = Transaction(
            type=TransactionType.dispute,
            processor=PaymentProcessor.stripe,
            currency=dispute.currency,
            amount=-dispute.amount + tax_refund_amount,
            account_currency=dispute.currency,
            account_amount=-dispute.amount + tax_refund_amount,
            tax_amount=-tax_refund_amount,
            tax_country=payment_transaction.tax_country,
            tax_state=payment_transaction.tax_state,
            processor_fee_amount=balance_transaction.fee,  # Damn expensive dispute fees
            customer_id=payment_transaction.customer_id,
            charge_id=charge_id,
            dispute_id=dispute.id,
            payment_user_id=payment_transaction.payment_user_id,
            payment_organization_id=payment_transaction.payment_organization_id,
            pledge_id=payment_transaction.pledge_id,
            issue_reward_id=payment_transaction.issue_reward_id,
            subscription_id=payment_transaction.subscription_id,
        )
        session.add(dispute_transaction)

        # Create reversal transfers if it was already transferred
        transfer_transactions_couples = (
            await self._get_transfer_transactions_for_payment(
                session, payment_transaction=payment_transaction
            )
        )
        for transfer_transactions_couple in transfer_transactions_couples:
            outgoing, _ = transfer_transactions_couple
            # Refund each transfer proportionally
            transfer_refund_amount = abs(
                int(math.floor(outgoing.amount * dispute_amount) / total_amount)
            )
            await transfer_transaction_service.create_reversal_transfer(
                session,
                transfer_transactions=transfer_transactions_couple,
                destination_currency=dispute.currency,
                amount=transfer_refund_amount,
                reversal_transfer_metadata={
                    "stripe_charge_id": charge_id,
                    "stripe_dispute_id": dispute.id,
                },
            )

        await session.commit()

        return dispute_transaction

    async def create_dispute_reversal(
        self, session: AsyncSession, *, dispute: stripe_lib.Dispute
    ) -> Transaction:
        charge_id: str = get_expandable_id(dispute.charge)
        payment_transaction = await self.get_by(
            session, type=TransactionType.payment, charge_id=charge_id
        )
        if payment_transaction is None:
            raise DisputeUnknownPaymentTransaction(dispute.id, charge_id)

        balance_transaction = next(
            bt
            for bt in dispute.balance_transactions
            if bt.reporting_category == "dispute_reversal"
        )

        dispute_amount = dispute.amount
        total_amount = payment_transaction.amount + payment_transaction.tax_amount
        tax_amount = abs(
            int(
                math.floor(payment_transaction.tax_amount * dispute_amount)
                / total_amount
            )
        )

        dispute_transaction = Transaction(
            type=TransactionType.dispute,
            processor=PaymentProcessor.stripe,
            currency=dispute.currency,
            amount=dispute.amount - tax_amount,
            account_currency=dispute.currency,
            account_amount=dispute.amount - tax_amount,
            tax_amount=tax_amount,
            tax_country=payment_transaction.tax_country,
            tax_state=payment_transaction.tax_state,
            processor_fee_amount=balance_transaction.fee,  # Normally zero (hopefully!)
            customer_id=payment_transaction.customer_id,
            charge_id=charge_id,
            dispute_id=dispute.id,
            payment_user_id=payment_transaction.payment_user_id,
            payment_organization_id=payment_transaction.payment_organization_id,
            pledge_id=payment_transaction.pledge_id,
            issue_reward_id=payment_transaction.issue_reward_id,
            subscription_id=payment_transaction.subscription_id,
        )
        session.add(dispute_transaction)

        # Re-transfer if it was reversed
        reverse_transfer_transactions_couples = (
            await self._get_reverse_transfer_transactions_for_payment(
                session, payment_transaction=payment_transaction
            )
        )
        for (
            reverse_transfer_transactions_couple
        ) in reverse_transfer_transactions_couples:
            outgoing, _ = reverse_transfer_transactions_couple
            assert outgoing.account is not None
            await transfer_transaction_service.create_transfer(
                session,
                destination_account=outgoing.account,
                payment_transaction=payment_transaction,
                amount=abs(outgoing.amount),
                pledge=outgoing.pledge,
                subscription=outgoing.subscription,
                issue_reward=outgoing.issue_reward,
                transfer_metadata={
                    "stripe_charge_id": charge_id,
                    "stripe_dispute_id": dispute.id,
                },
            )

        await session.commit()

        return dispute_transaction

    async def _get_reverse_transfer_transactions_for_payment(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> list[tuple[Transaction, Transaction]]:
        transfer_transactions_statement = select(Transaction.id).where(
            Transaction.type == TransactionType.transfer,
            Transaction.payment_transaction_id == payment_transaction.id,
        )
        statement = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.transfer,
                Transaction.transfer_reversal_transaction_id.in_(
                    transfer_transactions_statement
                ),
            )
            .order_by(
                Transaction.transfer_correlation_key,
                Transaction.account_id.nulls_last(),
            )
            .options(
                joinedload(Transaction.account),
                joinedload(Transaction.pledge),
                joinedload(Transaction.subscription),
                joinedload(Transaction.issue_reward),
            )
        )

        result = await session.execute(statement)
        transactions = list(result.scalars().all())
        return [
            (t1, t2)
            for _, (t1, t2) in itertools.groupby(
                transactions, key=lambda t: t.transfer_correlation_key
            )
        ]


dispute_transaction = DisputeTransactionService(Transaction)
