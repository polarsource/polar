import uuid

from polar.enums import AccountType
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.utils import generate_uuid
from polar.models import Account, IssueReward, Pledge, Subscription, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession

from .base import BaseTransactionService


class TransferTransactionError(PolarError):
    ...


class UnsupportedAccountType(TransferTransactionError):
    def __init__(self, account_id: uuid.UUID, account_type: AccountType) -> None:
        self.account_id = account_id
        self.account_type = account_type
        message = (
            f"The destination account {account_id} is unsupported ({account_type})."
        )
        super().__init__(message)


class StripeNotConfiguredOnDestinationAccount(TransferTransactionError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = (
            f"The destination account {account_id} "
            "has no Stripe Connect account configured."
        )
        super().__init__(message)


class TransferTransactionService(BaseTransactionService):
    async def create_transfer(
        self,
        session: AsyncSession,
        *,
        destination_account: Account,
        currency: str,
        amount: int,
        pledge: Pledge | None = None,
        subscription: Subscription | None = None,
        issue_reward: IssueReward | None = None,
        transfer_source_transaction: str | None = None,
        transfer_metadata: dict[str, str] | None = None,
    ) -> tuple[Transaction, Transaction]:
        if destination_account.account_type == AccountType.stripe:
            processor = PaymentProcessor.stripe
        elif destination_account.account_type == AccountType.open_collective:
            processor = PaymentProcessor.open_collective
        else:
            raise UnsupportedAccountType(
                destination_account.id, destination_account.account_type
            )

        outgoing_transaction = Transaction(
            id=generate_uuid(),
            account=None,  # Polar account
            type=TransactionType.transfer,
            processor=processor,
            currency=currency,
            amount=-amount,  # Subtract the amount
            tax_amount=0,
            processor_fee_amount=0,
            pledge=pledge,
            issue_reward=issue_reward,
            subscription=subscription,
        )
        incoming_transaction = Transaction(
            id=generate_uuid(),
            account=destination_account,  # User account
            type=TransactionType.transfer,
            processor=processor,
            currency=currency,
            amount=amount,  # Add the amount
            tax_amount=0,
            processor_fee_amount=0,
            pledge=pledge,
            issue_reward=issue_reward,
            subscription=subscription,
        )

        if processor == PaymentProcessor.stripe:
            if destination_account.stripe_id is None:
                raise StripeNotConfiguredOnDestinationAccount(destination_account.id)
            stripe_transfer = stripe_service.transfer(
                destination_account.stripe_id,
                amount,
                source_transaction=transfer_source_transaction,
                metadata={
                    "outgoing_transaction_id": str(outgoing_transaction.id),
                    "incoming_transaction_id": str(incoming_transaction.id),
                    **(transfer_metadata or {}),
                },
            )

            if stripe_transfer.balance_transaction is not None:
                balance_transaction = stripe_service.get_balance_transaction(
                    get_expandable_id(stripe_transfer.balance_transaction)
                )
                outgoing_transaction.processor_fee_amount = balance_transaction.fee
                incoming_transaction.processor_fee_amount = balance_transaction.fee

            outgoing_transaction.transfer_id = stripe_transfer.id
            incoming_transaction.transfer_id = stripe_transfer.id
        elif processor == PaymentProcessor.open_collective:
            """
            Nothing relevant to do: it's just a way for us
            to have a balance for this account.
            The money will really be transferred during payout.
            """

        session.add(outgoing_transaction)
        session.add(incoming_transaction)
        await session.commit()

        return (outgoing_transaction, incoming_transaction)


transfer_transaction = TransferTransactionService(Transaction)
