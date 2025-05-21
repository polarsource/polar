import uuid
from collections.abc import Sequence

import stripe as stripe_lib
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User
from polar.checkout.repository import CheckoutRepository
from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Checkout, Customer, Order, Payment, Product
from polar.models.payment import PaymentStatus
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession

from .repository import PaymentRepository
from .sorting import PaymentSortProperty


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
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        checkout_id: Sequence[uuid.UUID] | None = None,
        order_id: Sequence[uuid.UUID] | None = None,
        status: Sequence[PaymentStatus] | None = None,
        method: Sequence[str] | None = None,
        customer_email: Sequence[str] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[PaymentSortProperty]] = [
            (PaymentSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Payment], int]:
        repository = PaymentRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(Payment.organization_id.in_(organization_id))

        if checkout_id is not None:
            statement = statement.where(Payment.checkout_id.in_(checkout_id))

        if order_id is not None:
            statement = statement.where(Payment.order_id.in_(order_id))

        if status is not None:
            statement = statement.where(Payment.status.in_(status))

        if method is not None:
            statement = statement.where(Payment.method.in_(method))

        if customer_email is not None:
            statement = statement.where(Payment.customer_email.in_(customer_email))

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Payment | None:
        repository = PaymentRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            Payment.id == id
        )
        return await repository.get_one_or_none(statement)

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
        payment.customer_email = charge.billing_details.email

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
        payment.customer_email = payment_intent.receipt_email

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

        order: Order | None = None
        order_repository = OrderRepository.from_session(session)
        if payment_intent.invoice is not None:
            invoice_id = get_expandable_id(payment_intent.invoice)
            order = await order_repository.get_by_stripe_invoice_id(
                invoice_id,
                options=(joinedload(Order.customer).joinedload(Customer.organization),),
            )
        payment.order = order

        if checkout is None and order is None:
            raise UnlinkedPaymentError(payment_intent.id)

        if checkout is not None:
            payment.organization = checkout.organization
        elif order is not None:
            payment.organization = order.organization

        repository = PaymentRepository.from_session(session)
        return await repository.create(payment)


payment = PaymentService()
