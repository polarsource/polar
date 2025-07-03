import uuid

import stripe as stripe_lib

from polar.checkout.repository import CheckoutRepository
from polar.checkout.service import checkout as checkout_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Checkout, Order, Payment, PaymentMethod
from polar.order.repository import OrderRepository
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


async def resolve_order(
    session: AsyncSession,
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
    checkout: Checkout | None,
) -> Order | None:
    order_repository = OrderRepository.from_session(session)
    if (
        object.metadata is not None
        and (order_id := object.metadata.get("order_id")) is not None
    ):
        return await order_repository.get_by_id(
            uuid.UUID(order_id), options=order_repository.get_eager_options()
        )

    if object.OBJECT_NAME == "charge" and object.invoice is not None:
        invoice_id = get_expandable_id(object.invoice)
        return await order_repository.get_by_stripe_invoice_id(
            invoice_id, options=order_repository.get_eager_options()
        )

    if checkout is not None:
        return await order_repository.get_earliest_by_checkout_id(
            checkout.id, options=order_repository.get_eager_options()
        )

    return None


async def handle_success(
    session: AsyncSession, object: stripe_lib.Charge | stripe_lib.SetupIntent
) -> None:
    checkout = await resolve_checkout(session, object)
    order = await resolve_order(session, object, checkout)

    payment: Payment | None = None
    if object.OBJECT_NAME == "charge":
        payment = await payment_service.upsert_from_stripe_charge(
            session, object, checkout, order
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
    order = await resolve_order(session, object, checkout)

    payment: Payment | None = None
    if object.OBJECT_NAME == "charge":
        payment = await payment_service.upsert_from_stripe_charge(
            session, object, checkout, order
        )
    elif object.OBJECT_NAME == "payment_intent":
        payment = await payment_service.create_from_stripe_payment_intent(
            session, object, checkout, order
        )

    if checkout is not None:
        await checkout_service.handle_failure(session, checkout, payment=payment)


__all__ = [
    "handle_success",
    "handle_failure",
    "resolve_checkout",
    "resolve_order",
]
