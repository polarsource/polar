import uuid
from typing import cast

from polar.account.service import account as account_service
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


class StripeNotConfiguredOnAccount(TransferTransactionError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"The account {account_id} has no Stripe Connect account configured."
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
                raise StripeNotConfiguredOnAccount(destination_account.id)
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

    async def create_reversal_transfer(
        self,
        session: AsyncSession,
        *,
        transfer_transactions: tuple[Transaction, Transaction],
        amount: int,
        reversal_transfer_metadata: dict[str, str] | None = None,
    ) -> tuple[Transaction, Transaction]:
        outgoing, incoming = transfer_transactions
        processor = outgoing.processor
        currency = outgoing.currency
        source_account_id = incoming.account_id
        assert source_account_id is not None

        source_account = await account_service.get(session, source_account_id)
        assert source_account is not None

        outgoing_reversal = Transaction(
            id=generate_uuid(),
            account=source_account,  # User account
            type=TransactionType.transfer,
            processor=processor,
            currency=currency,
            amount=-amount,  # Subtract the amount
            tax_amount=0,
            processor_fee_amount=0,
            pledge_id=outgoing.pledge_id,
            issue_reward_id=outgoing.issue_reward_id,
            subscription_id=outgoing.subscription_id,
        )
        incoming_reversal = Transaction(
            id=generate_uuid(),
            account=None,  # Polar account
            type=TransactionType.transfer,
            processor=processor,
            currency=currency,
            amount=amount,  # Add the amount
            tax_amount=0,
            processor_fee_amount=0,
            pledge_id=outgoing.pledge_id,
            issue_reward_id=outgoing.issue_reward_id,
            subscription_id=outgoing.subscription_id,
        )

        if processor == PaymentProcessor.stripe:
            if source_account.stripe_id is None:
                raise StripeNotConfiguredOnAccount(source_account.id)
            stripe_reversal = stripe_service.reverse_transfer(
                cast(str, incoming.transfer_id),
                amount,
                metadata={
                    "outgoing_transaction_id": str(outgoing_reversal.id),
                    "incoming_transaction_id": str(incoming_reversal.id),
                    **(reversal_transfer_metadata or {}),
                },
            )
            outgoing_reversal.transfer_reversal_id = stripe_reversal.id
            incoming_reversal.transfer_reversal_id = stripe_reversal.id
        elif processor == PaymentProcessor.open_collective:
            """
            Nothing relevant to do: it's just a way for us
            to have a balance for this account.
            The money will really be transferred during payout.
            """

        session.add(outgoing_reversal)
        session.add(incoming_reversal)
        await session.commit()

        return (outgoing_reversal, incoming_reversal)


transfer_transaction = TransferTransactionService(Transaction)
