import uuid

import stripe as stripe_lib
import structlog

from polar.account.service import account as account_service
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.logging import Logger
from polar.models import Account, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession

from .base import BaseTransactionService

log: Logger = structlog.get_logger()


class PayoutTransactionError(PolarError):
    ...


class StripePayoutNotPaid(PayoutTransactionError):
    def __init__(self, payout_id: str) -> None:
        self.payout_id = payout_id
        message = "This Stripe payout is not paid, can't write it to transactions."
        super().__init__(message)


class UnknownAccount(PayoutTransactionError):
    def __init__(self, stripe_account_id: str) -> None:
        self.stripe_account_id = stripe_account_id
        message = (
            "Received a payout event for an "
            f"unknown Stripe account {stripe_account_id}"
        )
        super().__init__(message)


class UnknownTransaction(PayoutTransactionError):
    def __init__(self, transaction_id: uuid.UUID) -> None:
        self.transaction_id = transaction_id
        message = f"Unknown transaction {transaction_id}"
        super().__init__(message)


class PayoutTransactionService(BaseTransactionService):
    async def create_payout_from_stripe(
        self,
        session: AsyncSession,
        *,
        payout: stripe_lib.Payout,
        stripe_account_id: str,
    ) -> Transaction:
        bound_logger = log.bind(
            stripe_account_id=stripe_account_id, payout_id=payout.id
        )

        if payout.status != "paid":
            raise StripePayoutNotPaid(payout.id)

        account = await account_service.get_by_stripe_id(session, stripe_account_id)
        if account is None:
            raise UnknownAccount(stripe_account_id)

        transaction = Transaction(
            type=TransactionType.payout,
            processor=PaymentProcessor.stripe,
            currency="usd",  # FIXME: Main Polar currency
            amount=0,
            account_currency=payout.currency,
            account_amount=-payout.amount,  # Subtract the amount from the balance
            tax_amount=0,
            processor_fee_amount=0,  # No way to know the fee on a per payout basis
            payout_id=payout.id,
            account=account,
        )

        # Retrieve and mark all transactions paid by this payout
        balance_transactions = stripe_service.list_balance_transactions(
            account_id=account.stripe_id, payout=payout.id
        )
        for balance_transaction in balance_transactions:
            source = balance_transaction.source
            if source is not None:
                source_transfer: str | None = getattr(source, "source_transfer", None)
                if source_transfer is not None:
                    paid_transaction = await self.get_by(
                        session,
                        account_id=account.id,
                        transfer_id=source_transfer,
                    )
                    if paid_transaction is not None:
                        paid_transaction.payout_transaction = transaction
                        session.add(paid_transaction)

                        # Compute the amount in our main currency
                        transaction.currency = paid_transaction.currency
                        transaction.amount -= paid_transaction.amount
                    else:
                        bound_logger.warning(
                            "An unknown transaction was paid out",
                            source_id=get_expandable_id(source),
                            transfer_id=source_transfer,
                        )
                else:
                    bound_logger.warning(
                        "An unknown type of transaction was paid out",
                        source_id=get_expandable_id(source),
                    )

        session.add(transaction)
        await session.commit()

        return transaction

    async def create_manual_payout(
        self,
        session: AsyncSession,
        *,
        processor: PaymentProcessor,
        account: Account,
        paid_transaction_ids: list[uuid.UUID],
    ) -> Transaction:
        transaction = Transaction(
            type=TransactionType.payout,
            processor=processor,
            amount=0,
            account_currency=account.currency,
            account_amount=0,
            tax_amount=0,
            processor_fee_amount=0,
            account=account,
        )

        for paid_transaction_id in paid_transaction_ids:
            paid_transaction = await self.get_by(
                session, id=paid_transaction_id, account_id=account.id
            )
            if paid_transaction is None:
                raise UnknownTransaction(paid_transaction_id)

            transaction.currency = paid_transaction.currency
            transaction.amount -= paid_transaction.amount
            transaction.account_amount -= paid_transaction.account_amount
            paid_transaction.payout_transaction = transaction
            session.add(paid_transaction)

        session.add(transaction)
        await session.commit()

        return transaction


payout_transaction = PayoutTransactionService(Transaction)
