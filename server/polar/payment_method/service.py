import uuid

import stripe as stripe_lib
from sqlalchemy import select

from polar.customer.repository import CustomerRepository
from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Checkout, Customer, Order, PaymentMethod, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession

from .repository import PaymentMethodRepository


class PaymentMethodError(PolarError): ...


class NoPaymentMethodOnIntent(PaymentMethodError):
    def __init__(self, intent_id: str) -> None:
        self.intent_id = intent_id
        message = f"No payment method found on Stripe intent with ID {intent_id}."
        super().__init__(message)


class NotRecurringProduct(PaymentMethodError):
    def __init__(self, product_id: uuid.UUID) -> None:
        self.product_id = product_id
        message = f"Product with ID {product_id} is not a recurring product."
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

        return await repository.update(payment_method, flush=flush)

    async def upsert_from_stripe_intent(
        self,
        session: AsyncSession,
        intent: stripe_lib.Charge | stripe_lib.SetupIntent,
        checkout: Checkout,
    ) -> PaymentMethod:
        if intent.payment_method is None:
            raise NoPaymentMethodOnIntent(intent.id)

        if not checkout.product.is_recurring:
            raise NotRecurringProduct(checkout.product.id)

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

        if not order.product.is_recurring:
            return None

        stripe_payment_method = await stripe_service.get_payment_method(
            get_expandable_id(payment_intent.payment_method)
        )

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(order.customer_id)
        assert customer is not None

        return await self.upsert_from_stripe(session, customer, stripe_payment_method)

    async def _get_active_subscription_ids(
        self,
        session: AsyncSession,
        payment_method: PaymentMethod,
    ) -> list[uuid.UUID]:
        repository = PaymentMethodRepository.from_session(session)
        stmt = select(Subscription.id).where(
            Subscription.payment_method_id == payment_method.id,
            Subscription.status.in_(SubscriptionStatus.active_statuses()),
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

            if (
                subscription.stripe_subscription_id
                and to_payment_method.processor == PaymentProcessor.stripe
            ):
                await stripe_service.set_automatically_charged_subscription(
                    subscription.stripe_subscription_id,
                    payment_method=to_payment_method.processor_id,
                )

        await session.flush()

    async def delete(
        self,
        session: AsyncSession,
        payment_method: PaymentMethod,
    ) -> None:
        active_subscription_ids = await self._get_active_subscription_ids(
            session, payment_method
        )

        if active_subscription_ids:
            alternative_payment_method = await self._get_alternative_payment_method(
                session, payment_method
            )

            if alternative_payment_method:
                await self._reassign_subscriptions_payment_method(
                    session,
                    from_payment_method=payment_method,
                    to_payment_method=alternative_payment_method,
                    subscription_ids=active_subscription_ids,
                )
            else:
                # No alternative payment method available, raise exception
                raise PaymentMethodInUseByActiveSubscription(active_subscription_ids)

        if payment_method.processor == PaymentProcessor.stripe:
            await stripe_service.delete_payment_method(payment_method.processor_id)

        repository = PaymentMethodRepository.from_session(session)
        await repository.soft_delete(payment_method)


payment_method = PaymentMethodService()
