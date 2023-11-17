import stripe as stripe_lib

from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.services import ResourceServiceReader
from polar.models import Pledge, Subscription, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.subscription.service.subscription import subscription as subscription_service


class PaymentTransactionError(PolarError):
    ...


class SubscriptionDoesNotExist(PaymentTransactionError):
    def __init__(self, charge_id: str, stripe_subscription_id: str) -> None:
        self.charge_id = charge_id
        self.stripe_subscription_id = stripe_subscription_id
        message = (
            f"Received the charge {charge_id} from Stripe related to subscription "
            f"{stripe_subscription_id}, but no associated Subscription exists."
        )
        super().__init__(message)


class PaymentTransactionService(ResourceServiceReader[Transaction]):
    async def create_payment(
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


payment_transaction = PaymentTransactionService(Transaction)
