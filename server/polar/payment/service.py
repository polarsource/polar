import uuid
from collections.abc import Sequence

import stripe as stripe_lib
from sqlalchemy import func, or_

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import generate_uuid
from polar.models import Checkout, Order, Payment, PaymentMethod, Wallet
from polar.models.payment import (
    STRIPE_PAYMENT_INTENT_METADATA_KEY,
    PaymentStatus,
    PaymentTrigger,
)
from polar.payment_method.repository import PaymentMethodRepository
from polar.postgres import AsyncReadSession, AsyncSession

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


# A pending intent only names the methods it allows, never the one being used.
# The charge, or a payment method we already know, names it.
UNKNOWN_PAYMENT_METHOD = "unknown"


def _stripe_payment_intent_id(
    payment_intent: str | stripe_lib.PaymentIntent | None,
) -> str | None:
    if payment_intent is None:
        return None
    return payment_intent if isinstance(payment_intent, str) else payment_intent.id


class PaymentService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        checkout_id: Sequence[uuid.UUID] | None = None,
        order_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        status: Sequence[PaymentStatus] | None = None,
        method: Sequence[str] | None = None,
        customer_email: Sequence[str] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[PaymentSortProperty]] = [
            (PaymentSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Payment], int]:
        repository = PaymentRepository.from_session(session)
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.sales_read
        )
        statement = repository.get_statement_by_org_ids(org_ids)

        if organization_id is not None:
            statement = statement.where(Payment.organization_id.in_(organization_id))

        if checkout_id is not None:
            statement = statement.where(Payment.checkout_id.in_(checkout_id))

        if order_id is not None:
            statement = statement.where(Payment.order_id.in_(order_id))

        if customer_id is not None:
            statement = statement.outerjoin(Order, Payment.order_id == Order.id)
            statement = statement.outerjoin(
                Checkout, Payment.checkout_id == Checkout.id
            )
            effective_customer_id = func.coalesce(
                Order.customer_id, Checkout.customer_id
            )

            statement = statement.where(
                effective_customer_id.in_(customer_id),
                or_(Order.is_deleted.is_(False), Order.id.is_(None)),
            )

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
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Payment | None:
        repository = PaymentRepository.from_session(session)
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.sales_read
        )
        statement = repository.get_statement_by_org_ids(org_ids).where(Payment.id == id)
        return await repository.get_one_or_none(statement)

    async def upsert_from_stripe_charge(
        self,
        session: AsyncSession,
        charge: stripe_lib.Charge,
        organization: Organization,
        checkout: Checkout | None,
        wallet: Wallet | None,
        order: Order | None,
        trigger: PaymentTrigger | None = None,
    ) -> Payment:
        repository = PaymentRepository.from_session(session)
        payment_intent_id = _stripe_payment_intent_id(charge.payment_intent)

        payment = await repository.get_by_processor_id(
            PaymentProcessor.stripe, charge.id
        )

        if payment is None and payment_intent_id is not None:
            payment = await repository.get_by_stripe_payment_intent_id(
                payment_intent_id
            )
            if payment is not None:
                payment.processor_id = charge.id

        if payment is None:
            payment = Payment(
                id=generate_uuid(),
                processor=PaymentProcessor.stripe,
                processor_id=charge.id,
                processor_metadata=(
                    {STRIPE_PAYMENT_INTENT_METADATA_KEY: payment_intent_id}
                    if payment_intent_id is not None
                    else {}
                ),
            )

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

        payment.trigger = trigger
        payment.checkout = checkout
        payment.order = order
        payment.wallet = wallet
        payment.organization = organization

        return await repository.update(payment)

    async def upsert_pending_from_stripe_payment_intent(
        self,
        session: AsyncSession,
        payment_intent: stripe_lib.PaymentIntent,
        organization: Organization,
        *,
        checkout: Checkout | None = None,
        order: Order | None = None,
        wallet: Wallet | None = None,
        trigger: PaymentTrigger | None = None,
    ) -> Payment | None:
        """Record an attempt that hasn't produced a charge yet, typically one
        waiting on 3DS authentication. Once a charge exists it carries the
        method and the outcome, so it becomes the record."""
        if payment_intent.latest_charge is not None:
            return None

        repository = PaymentRepository.from_session(session)
        payment = await repository.get_by_stripe_payment_intent_id(payment_intent.id)
        if payment is None:
            payment = Payment(
                id=generate_uuid(),
                processor=PaymentProcessor.stripe,
                processor_id=payment_intent.id,
                processor_metadata={
                    STRIPE_PAYMENT_INTENT_METADATA_KEY: payment_intent.id
                },
                method=UNKNOWN_PAYMENT_METHOD,
                method_metadata={},
            )

        payment_method = await self._get_stripe_payment_method(
            session, payment_intent.payment_method
        )

        payment.status = PaymentStatus.pending
        payment.amount = payment_intent.amount
        payment.currency = payment_intent.currency
        if payment_method is not None:
            payment.method = payment_method.type
            payment.method_metadata = payment_method.method_metadata
        payment.customer_email = payment_intent.receipt_email
        payment.trigger = trigger
        payment.checkout = checkout
        payment.order = order
        payment.wallet = wallet
        payment.organization = organization

        return await repository.update(payment, flush=True)

    async def cancel_from_stripe_payment_intent(
        self, session: AsyncSession, payment_intent: stripe_lib.PaymentIntent
    ) -> Payment | None:
        repository = PaymentRepository.from_session(session)
        payment = await repository.get_by_stripe_payment_intent_id(payment_intent.id)
        if payment is None:
            return None

        return await repository.update(
            payment, update_dict={"status": PaymentStatus.failed}, flush=True
        )

    async def _get_stripe_payment_method(
        self,
        session: AsyncSession,
        payment_method: str | stripe_lib.PaymentMethod | None,
    ) -> PaymentMethod | None:
        if payment_method is None:
            return None

        processor_id = (
            payment_method if isinstance(payment_method, str) else payment_method.id
        )
        repository = PaymentMethodRepository.from_session(session)
        return await repository.get_by_processor_id(
            PaymentProcessor.stripe, processor_id
        )

    async def upsert_from_stripe_payment_intent(
        self,
        session: AsyncSession,
        payment_intent: stripe_lib.PaymentIntent,
        organization: Organization,
        checkout: Checkout | None,
        order: Order | None,
        trigger: PaymentTrigger | None = None,
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

        repository = PaymentRepository.from_session(session)

        payment = await repository.get_by_processor_id(
            PaymentProcessor.stripe, payment_intent.id
        )
        if payment is None:
            payment = Payment(
                id=generate_uuid(),
                processor=PaymentProcessor.stripe,
                processor_id=payment_intent.id,
            )

        payment.status = PaymentStatus.failed
        payment.amount = payment_intent.amount
        payment.currency = payment_intent.currency

        payment_error = payment_intent.last_payment_error
        payment_method = payment_error.payment_method
        assert payment_method is not None
        payment.method = payment_method.type
        payment.method_metadata = dict(payment_method[payment_method.type])
        payment.customer_email = payment_intent.receipt_email

        payment.decline_reason = getattr(payment_error, "code", None)
        payment.decline_message = payment_error.message

        payment.trigger = trigger
        payment.checkout = checkout
        payment.order = order
        payment.organization = organization

        return await repository.update(payment)


payment = PaymentService()
