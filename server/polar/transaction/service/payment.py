from typing import cast

import stripe as stripe_lib

from polar.exceptions import PolarError
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Pledge, Subscription, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.organization.service import organization as organization_service
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.subscription.service.subscription import subscription as subscription_service
from polar.user.service import user as user_service

from .base import BaseTransactionService


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


class PledgeDoesNotExist(PaymentTransactionError):
    def __init__(self, charge_id: str, payment_intent_id: str) -> None:
        self.charge_id = charge_id
        self.payment_intent_id = payment_intent_id
        message = (
            f"Received a ledge charge {charge_id} ({payment_intent_id} from Stripe "
            "but no such Pledge exists."
        )
        super().__init__(message)


class PaymentTransactionService(BaseTransactionService):
    async def create_payment(
        self, session: AsyncSession, *, charge: stripe_lib.Charge
    ) -> Transaction:
        subscription: Subscription | None = None
        pledge: Pledge | None = None

        # Retrieve customer
        customer_id = None
        payment_user = None
        payment_organization = None
        if charge.customer:
            customer_id = get_expandable_id(charge.customer)
            payment_user = await user_service.get_by_stripe_customer_id(
                session, customer_id
            )
            payment_organization = await organization_service.get_by(
                session, stripe_customer_id=customer_id
            )

        # Retrieve tax amount and country
        tax_amount = 0
        tax_country = None
        tax_state = None
        if charge.invoice:
            stripe_invoice = stripe_service.get_invoice(
                get_expandable_id(charge.invoice)
            )
            if stripe_invoice.tax is not None:
                tax_amount = stripe_invoice.tax
            for total_tax_amount in stripe_invoice.total_tax_amounts:
                tax_rate = cast(stripe_lib.TaxRate, total_tax_amount.tax_rate)
                tax_country = tax_rate.country
                tax_state = tax_rate.state

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
        if charge.metadata.get("type") == ProductType.pledge:
            assert charge.payment_intent is not None
            payment_intent = get_expandable_id(charge.payment_intent)
            pledge = await pledge_service.get_by_payment_id(session, payment_intent)
            # Give a chance to retry this later in case we didn't create the Pledge yet.
            if pledge is None:
                raise PledgeDoesNotExist(charge.id, payment_intent)

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
            tax_country=tax_country,
            tax_state=tax_state,
            processor_fee_amount=processor_fee_amount,
            customer_id=customer_id,
            payment_user=payment_user,
            payment_organization=payment_organization,
            charge_id=charge.id,
            pledge=pledge,
            subscription=subscription,
        )

        session.add(transaction)
        await session.commit()

        return transaction


payment_transaction = PaymentTransactionService(Transaction)
