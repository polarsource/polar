import stripe as stripe_lib

from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import Customer, PaymentMethod
from polar.postgres import AsyncSession

from .repository import PaymentMethodRepository


class PaymentMethodError(PolarError): ...


class DifferentCustomerError(PaymentMethodError):
    def __init__(self, payment_method: PaymentMethod, customer: Customer) -> None:
        self.payment_method = payment_method
        self.customer = customer
        message = (
            f"Payment method {payment_method.id} is already linked to "
            f"customer {payment_method.customer_id}, not {customer.id}."
        )
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

        payment_method = await repository.get_by_processor_id(
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

        if payment_method.customer != customer:
            raise DifferentCustomerError(payment_method, customer)

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
