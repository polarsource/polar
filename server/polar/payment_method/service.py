import stripe as stripe_lib

from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import Customer, PaymentMethod
from polar.postgres import AsyncSession

from .repository import PaymentMethodRepository


class PaymentMethodError(PolarError): ...


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
