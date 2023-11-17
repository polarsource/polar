import uuid

import stripe as stripe_lib

from polar.enums import AccountType
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.services import ResourceServiceReader
from polar.models import Account, IssueReward, Pledge, Subscription, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.subscription.service.subscription import subscription as subscription_service


class TransactionError(PolarError):
    ...


class SubscriptionDoesNotExist(TransactionError):
    def __init__(self, charge_id: str, stripe_subscription_id: str) -> None:
        self.charge_id = charge_id
        self.stripe_subscription_id = stripe_subscription_id
        message = (
            f"Received the charge {charge_id} from Stripe related to subscription "
            f"{stripe_subscription_id}, but no associated Subscription exists."
        )
        super().__init__(message)


class UnsupportedAccountType(TransactionError):
    def __init__(self, account_id: uuid.UUID, account_type: AccountType) -> None:
        self.account_id = account_id
        self.account_type = account_type
        message = (
            f"The destination account {account_id} is unsupported ({account_type})."
        )
        super().__init__(message)


class StripeNotConfiguredOnDestinationAccount(TransactionError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = (
            f"The destination account {account_id} "
            "has no Stripe Connect account configured."
        )
        super().__init__(message)


class TransactionService(ResourceServiceReader[Transaction]):
    async def stripe_handle_payment(
        self, session: AsyncSession, *, charge: stripe_lib.Charge
    ) -> Transaction:
        subscription: Subscription | None = None
        pledge: Pledge | None = None

        # Retrieve tax amount
        tax_amount = 0
        if charge.invoice:
            stripe_invoice = stripe_service.get_invoice(
                get_expandable_id(charge.invoice)
            )
            if stripe_invoice.tax is not None:
                tax_amount = stripe_invoice.tax

            # Try to link with a Subscription
            if stripe_invoice.subscription:
                stripe_subscription_id = get_expandable_id(stripe_invoice.subscription)
                subscription = await subscription_service.get_by_stripe_subscription_id(
                    session, stripe_subscription_id
                )
                # Give a chance to retry this later in case we didn't yet handle
                # the `customer.subscription.created` event.
                if subscription is None:
                    raise SubscriptionDoesNotExist(charge.id, stripe_subscription_id)

        # Try to link with a Pledge
        if charge.payment_intent:
            pledge = await pledge_service.get_by_payment_id(
                session, get_expandable_id(charge.payment_intent)
            )

        # Retrieve Stripe fee
        processor_fee_amount = 0
        if charge.balance_transaction:
            stripe_balance_transaction = stripe_service.get_balance_transaction(
                get_expandable_id(charge.balance_transaction)
            )
            processor_fee_amount = stripe_balance_transaction.fee

        transaction = Transaction(
            type=TransactionType.payment,
            processor=PaymentProcessor.stripe,
            currency=charge.currency,
            amount=charge.amount - tax_amount,
            tax_amount=tax_amount,
            processor_fee_amount=processor_fee_amount,
            charge_id=charge.id,
            pledge=pledge,
            subscription=subscription,
        )

        session.add(transaction)
        await session.commit()

        return transaction

    async def handle_transfer(
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
            transfer_group = "TODO_TODO"
            stripe_transfer = stripe_service.transfer(
                destination_account.stripe_id,
                amount,
                transfer_group,
                source_transaction=transfer_source_transaction,
                metadata={
                    "outgoing_transaction_id": str(outgoing_transaction.id),
                    "incoming_transaction_id": str(incoming_transaction.id),
                    **(transfer_metadata or {}),
                },
            )
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


transaction = TransactionService(Transaction)
