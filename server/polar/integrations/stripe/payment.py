import uuid

import stripe as stripe_lib

from polar.checkout.repository import CheckoutRepository
from polar.checkout.service import checkout as checkout_service
from polar.models import Checkout, Payment, PaymentMethod
from polar.payment.service import payment as payment_service
from polar.payment_method.service import payment_method as payment_method_service
from polar.postgres import AsyncSession


async def resolve_checkout(
    session: AsyncSession,
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
) -> Checkout | None:
    if object.metadata is None:
        return None

    if (checkout_id := object.metadata.get("checkout_id")) is None:
        return None

    repository = CheckoutRepository.from_session(session)
    return await repository.get_by_id(
        uuid.UUID(checkout_id), options=repository.get_eager_options()
    )


async def handle_success(
    session: AsyncSession, object: stripe_lib.Charge | stripe_lib.SetupIntent
) -> None:
    checkout = await resolve_checkout(session, object)

    payment: Payment | None = None
    if object.OBJECT_NAME == "charge":
        payment = await payment_service.upsert_from_stripe_charge(
            session, object, checkout
        )

    if checkout is not None:
        payment_method: PaymentMethod | None = None
        if checkout.product.is_recurring:
            payment_method = await payment_method_service.upsert_from_stripe_intent(
                session, object, checkout
            )

        await checkout_service.handle_success(
            session,
            checkout,
            payment=payment,
            payment_method=payment_method,
        )


async def handle_failure(
    session: AsyncSession,
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
) -> None:
    checkout = await resolve_checkout(session, object)

    payment: Payment | None = None
    if object.OBJECT_NAME == "charge":
        payment = await payment_service.upsert_from_stripe_charge(
            session, object, checkout
        )
    elif object.OBJECT_NAME == "payment_intent":
        payment = await payment_service.create_from_stripe_payment_intent(
            session, object, checkout
        )

    if checkout is not None:
        await checkout_service.handle_failure(session, checkout, payment=payment)


__all__ = [
    "handle_success",
    "handle_failure",
    "resolve_checkout",
]
