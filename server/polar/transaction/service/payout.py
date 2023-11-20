import stripe as stripe_lib
import structlog

from polar.account.service import account as account_service
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession

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


class PayoutTransactionService(ResourceServiceReader[Transaction]):
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

        # Retrieve Stripe fee
        processor_fee_amount = 0
        if payout.balance_transaction is not None:
            stripe_balance_transaction = stripe_service.get_balance_transaction(
                get_expandable_id(payout.balance_transaction)
            )
            processor_fee_amount = stripe_balance_transaction.fee

        transaction = Transaction(
            type=TransactionType.payout,
            processor=PaymentProcessor.stripe,
            currency=payout.currency,
            amount=-payout.amount,  # Subtract the amount from the balance
            tax_amount=0,
            processor_fee_amount=processor_fee_amount,
            payout_id=payout.id,
            account=account,
        )
        session.add(transaction)

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

        await session.commit()

        return transaction


payout_transaction = PayoutTransactionService(Transaction)
