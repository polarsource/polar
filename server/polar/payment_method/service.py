import uuid

import stripe as stripe_lib

from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Checkout, Customer, PaymentMethod
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

    async def delete(
        self,
        session: AsyncSession,
        payment_method: PaymentMethod,
    ) -> None:
        if payment_method.processor == PaymentProcessor.stripe:
            await stripe_service.delete_payment_method(payment_method.processor_id)

        repository = PaymentMethodRepository.from_session(session)
        await repository.soft_delete(payment_method)


payment_method = PaymentMethodService()
