import uuid

import stripe as stripe_lib
from sqlalchemy import select

from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession

from .base import BaseTransactionService
from .transfer import transfer_transaction as transfer_transaction_service


class RefundTransactionError(PolarError):
    ...


class RefundUnknownPaymentTransaction(PolarError):
    def __init__(self, charge_id: str) -> None:
        self.charge_id = charge_id
        message = (
            f"Refund issued for charge {charge_id}, "
            "but the payment transaction is unknown."
        )
        super().__init__(message)


class MoreThanTwoTransfersForSinglePayment(PolarError):
    def __init__(
        self,
        payment_transaction_id: uuid.UUID,
        transfer_transaction_ids: list[uuid.UUID],
    ) -> None:
        self.payment_transaction_id = payment_transaction_id
        self.transfer_transaction_ids = transfer_transaction_ids
        message = (
            f"More than two transfer transactions were found "
            f"for payment {payment_transaction_id}: "
            f"{', '.join([str(id) for id in transfer_transaction_ids])}"
        )
        super().__init__(message)


class RefundTransactionService(BaseTransactionService):
    async def create_refunds(
        self, session: AsyncSession, *, charge: stripe_lib.Charge
    ) -> list[Transaction]:
        # Get all the refunds for this charge
        refunds = stripe_service.list_refunds(charge=charge.id)

        payment_transaction = await self.get_by(session, charge_id=charge.id)
        if payment_transaction is None:
            raise RefundUnknownPaymentTransaction(charge.id)

        refund_transactions: list[Transaction] = []
        # Handle each individual refund
        for refund in refunds:
            if refund.status != "succeeded":
                continue

            # Already handled that refund before
            refund_transaction = await self.get_by(
                session, type=TransactionType.refund, refund_id=refund.id
            )
            if refund_transaction is not None:
                continue

            # Retrieve Stripe fee
            processor_fee_amount = 0
            if refund.balance_transaction is not None:
                balance_transaction = stripe_service.get_balance_transaction(
                    get_expandable_id(refund.balance_transaction)
                )
                processor_fee_amount = balance_transaction.fee

            refund_transaction = Transaction(
                type=TransactionType.refund,
                processor=PaymentProcessor.stripe,
                currency=refund.currency,
                amount=-refund.amount,
                account_currency=refund.currency,
                account_amount=-refund.amount,
                tax_amount=0,  # TODO?: I don't know how VAT works when refunding
                processor_fee_amount=processor_fee_amount,
                customer_id=payment_transaction.customer_id,
                charge_id=charge.id,
                refund_id=refund.id,
                payment_user_id=payment_transaction.payment_user_id,
                payment_organization_id=payment_transaction.payment_organization_id,
                pledge_id=payment_transaction.pledge_id,
                issue_reward_id=payment_transaction.issue_reward_id,
                subscription_id=payment_transaction.subscription_id,
            )
            session.add(refund_transaction)
            refund_transactions.append(refund_transaction)

            # Create reversal transfer if it was already transferred
            transfer_transactions = await self._get_transfer_transactions(
                session, payment_transaction=payment_transaction
            )
            if transfer_transactions is not None:
                await transfer_transaction_service.create_reversal_transfer(
                    session,
                    transfer_transactions=transfer_transactions,
                    destination_currency=refund.currency,
                    amount=refund.amount,
                    reversal_transfer_metadata={
                        "stripe_charge_id": charge.id,
                        "stripe_refund_id": refund.id,
                    },
                )

        await session.commit()

        return refund_transactions

    async def _get_transfer_transactions(
        self, session: AsyncSession, *, payment_transaction: Transaction
    ) -> tuple[Transaction, Transaction] | None:
        statement = select(Transaction).where(
            Transaction.type == TransactionType.transfer,
            Transaction.transfer_id.is_not(None),
            Transaction.transfer_reversal_id.is_(None),
        )
        if payment_transaction.subscription_id:
            statement = statement.where(
                Transaction.subscription_id == payment_transaction.subscription_id
            )
        elif payment_transaction.pledge_id:
            statement = statement.where(
                Transaction.pledge_id == payment_transaction.pledge_id
            )

        result = await session.execute(statement)
        transactions = result.scalars().all()

        if len(transactions) == 0:
            return None

        if len(transactions) != 2:
            raise MoreThanTwoTransfersForSinglePayment(
                payment_transaction.id, [transaction.id for transaction in transactions]
            )

        return (transactions[0], transactions[1])


refund_transaction = RefundTransactionService(Transaction)
