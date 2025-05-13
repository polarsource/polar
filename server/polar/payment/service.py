import uuid

import stripe as stripe_lib
from sqlalchemy.orm import joinedload

from polar.checkout.repository import CheckoutRepository
from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Checkout, Customer, Order, Payment, Product
from polar.models.payment import PaymentStatus
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession

from .repository import PaymentRepository


class PaymentError(PolarError): ...


class UnlinkedPaymentError(PaymentError):
    def __init__(self, processor_id: str) -> None:
        self.processor_id = processor_id
        message = (
            f"Received a payment with id {processor_id} that is not linked "
            "to any checkout or order."
        )
        super().__init__(message)


class UnhandledPaymentIntent(PaymentError):
    def __init__(self, payment_intent_id: str) -> None:
        self.payment_intent_id = payment_intent_id
        message = (
            f"Received a payment intent with id {payment_intent_id} "
            "that we shouldn't handle."
        )
        super().__init__(message)


class PaymentService:
    async def upsert_from_stripe_charge(
        self, session: AsyncSession, charge: stripe_lib.Charge
    ) -> Payment:
        repository = PaymentRepository.from_session(session)

        payment = await repository.get_by_processor_id(charge.id)
        if payment is None:
            payment = Payment(processor_id=charge.id)

        payment.processor = PaymentProcessor.stripe
        payment.status = PaymentStatus.from_stripe_charge(charge.status)
        payment.amount = charge.amount
        payment.currency = charge.currency

        payment_method_details = charge.payment_method_details
        assert payment_method_details is not None
        payment.method = payment_method_details.type
        payment.method_metadata = dict(
            payment_method_details[payment_method_details.type]
        )

        if charge.outcome is not None:
            payment.decline_reason = charge.outcome.reason
            # Stripe also sets success message, but we don't need it
            if payment.decline_reason is not None:
                payment.decline_message = charge.outcome.seller_message

            risk_level = charge.outcome.risk_level
            if risk_level is not None and risk_level != "not_assessed":
                payment.risk_level = risk_level
                payment.risk_score = charge.outcome.get("risk_score")

        checkout: Checkout | None = None
        if (checkout_id := charge.metadata.get("checkout_id")) is not None:
            checkout_repository = CheckoutRepository.from_session(session)
            checkout = await checkout_repository.get_by_id(
                uuid.UUID(checkout_id),
                options=(
                    joinedload(Checkout.product).joinedload(Product.organization),
                ),
            )
        payment.checkout = checkout

        order: Order | None = None
        order_repository = OrderRepository.from_session(session)
        if charge.invoice is not None:
            invoice_id = get_expandable_id(charge.invoice)
            order = await order_repository.get_by_stripe_invoice_id(
                invoice_id,
                options=(joinedload(Order.customer).joinedload(Customer.organization),),
            )
        elif checkout is not None:
            order_repository = OrderRepository.from_session(session)
            order = await order_repository.get_earliest_by_checkout_id(
                checkout.id,
                options=(joinedload(Order.customer).joinedload(Customer.organization),),
            )
        payment.order = order

        if checkout is None and order is None:
            raise UnlinkedPaymentError(charge.id)

        if checkout is not None:
            payment.organization = checkout.organization
        elif order is not None:
            payment.organization = order.organization

        return await repository.update(payment)

    async def create_from_stripe_payment_intent(
        self, session: AsyncSession, payment_intent: stripe_lib.PaymentIntent
    ) -> Payment:
        # Only handle payment intents that are not linked to a charge, and which
        # have a last_payment_error.
        # It's the case when the payment method fails authentication, like 3DS.
        # In other cases, we handle it through the charge (see above).
        if (
            payment_intent.latest_charge is not None
            or payment_intent.last_payment_error is None
        ):
            raise UnhandledPaymentIntent(payment_intent.id)

        payment = Payment(processor_id=payment_intent.id)

        payment.processor = PaymentProcessor.stripe
        payment.status = PaymentStatus.failed
        payment.amount = payment_intent.amount
        payment.currency = payment_intent.currency

        payment_error = payment_intent.last_payment_error
        payment_method = payment_error.payment_method
        assert payment_method is not None
        payment.method = payment_method.type
        payment.method_metadata = dict(payment_method[payment_method.type])

        payment.decline_reason = payment_error.code
        payment.decline_message = payment_error.message

        checkout: Checkout | None = None
        if (checkout_id := payment_intent.metadata.get("checkout_id")) is not None:
            checkout_repository = CheckoutRepository.from_session(session)
            checkout = await checkout_repository.get_by_id(
                uuid.UUID(checkout_id),
                options=(
                    joinedload(Checkout.product).joinedload(Product.organization),
                ),
            )
        payment.checkout = checkout

        if checkout is None:
            raise UnlinkedPaymentError(payment_intent.id)

        payment.organization = checkout.organization

        repository = PaymentRepository.from_session(session)
        return await repository.create(payment)


payment = PaymentService()
