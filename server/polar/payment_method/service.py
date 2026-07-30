import uuid
from datetime import date
from urllib.parse import urlencode

import stripe as stripe_lib
from babel.dates import format_date
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer.service import customer as customer_service
from polar.email.deduplication import payment_method_expiration_reminder_key
from polar.email.schemas import EmailAdapter
from polar.email.sender import enqueue_email_template
from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Checkout, Customer, Order, PaymentMethod, Subscription
from polar.models.organization import resolve_default_customer_email_settings
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository

from .repository import PaymentMethodRepository
from .schemas import PaymentMethodCard


class PaymentMethodError(PolarError): ...


class NoPaymentMethodOnIntent(PaymentMethodError):
    def __init__(self, intent_id: str) -> None:
        self.intent_id = intent_id
        message = f"No payment method found on Stripe intent with ID {intent_id}."
        super().__init__(message)


class PaymentMethodDoesNotExist(PaymentMethodError):
    def __init__(self, payment_method_id: uuid.UUID) -> None:
        self.payment_method_id = payment_method_id
        message = f"Payment method with ID {payment_method_id} does not exist."
        super().__init__(message)


class PaymentMethodInUseByActiveSubscription(PaymentMethodError):
    def __init__(self, subscription_ids: list[uuid.UUID]) -> None:
        self.subscription_ids = subscription_ids
        message = (
            "Cannot delete payment method. It is currently used by active "
            "subscription and no alternative payment methods "
        )
        super().__init__(message, 400)


class PaymentMethodService:
    async def upsert_from_stripe(
        self,
        session: AsyncSession,
        customer: Customer,
        stripe_payment_method: stripe_lib.PaymentMethod,
        *,
        flush: bool = False,
    ) -> PaymentMethod:
        repository = PaymentMethodRepository.from_session(session)

        payment_method = await repository.get_by_customer_and_processor_id(
            customer.id,
            PaymentProcessor.stripe,
            stripe_payment_method.id,
            include_deleted=True,
            options=repository.get_eager_options(),
        )
        if payment_method is None:
            payment_method = PaymentMethod(
                processor=PaymentProcessor.stripe,
                processor_id=stripe_payment_method.id,
                customer=customer,
            )

        payment_method.type = stripe_payment_method.type
        payment_method.method_metadata = stripe_payment_method[
            stripe_payment_method.type
        ]
        payment_method.deleted_at = None  # Restore if it was soft-deleted

        return await repository.update(payment_method, flush=flush)

    async def upsert_from_stripe_intent(
        self,
        session: AsyncSession,
        intent: stripe_lib.Charge | stripe_lib.SetupIntent,
        checkout: Checkout,
    ) -> PaymentMethod:
        if intent.payment_method is None:
            raise NoPaymentMethodOnIntent(intent.id)

        stripe_payment_method = await stripe_service.get_payment_method(
            get_expandable_id(intent.payment_method)
        )

        assert checkout.customer is not None
        return await self.upsert_from_stripe(
            session, checkout.customer, stripe_payment_method
        )

    async def upsert_from_stripe_payment_intent_for_order(
        self,
        session: AsyncSession,
        payment_intent: stripe_lib.PaymentIntent,
        order: Order,
    ) -> PaymentMethod | None:
        """
        Upsert payment method from PaymentIntent for order retry payments.
        Only saves if the order is for a recurring product and has a payment method attached.
        """
        if payment_intent.payment_method is None:
            return None

        if order.product and not order.product.is_recurring:
            return None

        stripe_payment_method = await stripe_service.get_payment_method(
            get_expandable_id(payment_intent.payment_method)
        )

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(
            order.customer_id, include_deleted=True
        )
        assert customer is not None

        return await self.upsert_from_stripe(session, customer, stripe_payment_method)

    async def get_customer_payment_method(
        self, session: AsyncSession, customer: Customer
    ) -> PaymentMethod | None:
        repository = PaymentMethodRepository.from_session(session)
        if customer.default_payment_method_id is not None:
            return await repository.get_by_id(
                customer.default_payment_method_id,
                options=repository.get_eager_options(),
            )

        payment_methods = await repository.list_by_customer(
            customer.id, options=repository.get_eager_options()
        )
        if len(payment_methods) > 0:
            return payment_methods[0]

        return None

    async def send_expiration_reminder_email(
        self, session: AsyncSession, payment_method: PaymentMethod
    ) -> None:
        if payment_method.type != "card":
            return

        card = PaymentMethodCard.model_validate(payment_method, from_attributes=True)
        expiration_date = format_date(
            date(card.method_metadata.exp_year, card.method_metadata.exp_month, 1),
            format="MMMM y",
            locale="en_US",
        )

        subscription_repository = SubscriptionRepository.from_session(session)
        subscriptions = await subscription_repository.list_billable_by_payment_method(
            payment_method.id, options=(joinedload(Subscription.product),)
        )
        product_names = sorted({s.product.name for s in subscriptions})
        # The card doesn't back anything billable, bail out
        if not product_names:
            return

        customer = payment_method.customer
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            customer.organization_id, include_deleted=True, include_blocked=True
        )
        assert organization is not None

        email_settings = resolve_default_customer_email_settings(
            organization.customer_email_settings
        )
        if not email_settings["payment_method_expiration_reminder"]:
            return

        recipients = await customer_service.get_email_recipients(session, customer)
        subject = f"Your card ending in {card.method_metadata.last4} expires soon"
        deduplication_key = payment_method_expiration_reminder_key(
            payment_method.id,
            card.method_metadata.exp_year,
            card.method_metadata.exp_month,
        )

        for recipient_email in recipients:
            token = await customer_service.create_session_token_for_recipient(
                session, customer, recipient_email
            )
            if token is None:
                continue

            query_string = urlencode(
                {"customer_session_token": token, "email": recipient_email}
            )
            portal_url = settings.generate_frontend_url(
                f"/{organization.slug}/portal/settings?{query_string}"
            )

            email = EmailAdapter.validate_python(
                {
                    "template": "payment_method_expiration_reminder",
                    "props": {
                        "email": recipient_email,
                        "organization": organization,
                        "payment_method": card,
                        "product_names": product_names,
                        "expiration_date": expiration_date,
                        "url": portal_url,
                    },
                }
            )

            enqueue_email_template(
                email,
                **organization.email_from_reply,
                to_email_addr=recipient_email,
                subject=subject,
                deduplication_key=deduplication_key,
            )

    async def _get_billable_subscription_ids(
        self, session: AsyncSession, payment_method: PaymentMethod
    ) -> list[uuid.UUID]:
        stmt = select(Subscription.id).where(
            Subscription.payment_method_id == payment_method.id,
            Subscription.billable.is_(True),
        )
        result = await session.execute(stmt)
        return [row[0] for row in result.fetchall()]

    async def _get_alternative_payment_method(
        self,
        session: AsyncSession,
        payment_method: PaymentMethod,
    ) -> PaymentMethod | None:
        repository = PaymentMethodRepository.from_session(session)
        alternative_methods = await repository.list_by_customer(
            payment_method.customer_id,
            exclude_id=payment_method.id,
        )

        if not alternative_methods:
            return None

        # Prefer the customer's default payment method if it's different from the one being deleted
        stmt = select(Customer.default_payment_method_id).where(
            Customer.id == payment_method.customer_id
        )
        result = await session.execute(stmt)
        default_pm_id = result.scalar_one_or_none()

        if default_pm_id and default_pm_id != payment_method.id:
            for method in alternative_methods:
                if method.id == default_pm_id:
                    return method

        # Otherwise, return the first available alternative
        return alternative_methods[0]

    async def _reassign_subscriptions_payment_method(
        self,
        session: AsyncSession,
        from_payment_method: PaymentMethod,
        to_payment_method: PaymentMethod,
        subscription_ids: list[uuid.UUID],
    ) -> None:
        stmt = select(Subscription).where(Subscription.id.in_(subscription_ids))
        result = await session.execute(stmt)
        subscriptions = list(result.scalars().all())

        for subscription in subscriptions:
            subscription.payment_method = to_payment_method

        await session.flush()

    async def delete(
        self,
        session: AsyncSession,
        payment_method: PaymentMethod,
        force: bool = False,
    ) -> None:
        billable_subscription_ids = await self._get_billable_subscription_ids(
            session, payment_method
        )

        if billable_subscription_ids:
            alternative_payment_method = await self._get_alternative_payment_method(
                session, payment_method
            )

            if alternative_payment_method:
                await self._reassign_subscriptions_payment_method(
                    session,
                    from_payment_method=payment_method,
                    to_payment_method=alternative_payment_method,
                    subscription_ids=billable_subscription_ids,
                )
            elif not force:
                # No alternative payment method available, raise exception
                raise PaymentMethodInUseByActiveSubscription(billable_subscription_ids)

        if payment_method.processor == PaymentProcessor.stripe:
            try:
                await stripe_service.delete_payment_method(payment_method.processor_id)
            except stripe_lib.InvalidRequestError:
                pass

        repository = PaymentMethodRepository.from_session(session)
        await repository.soft_delete(payment_method)


payment_method = PaymentMethodService()
