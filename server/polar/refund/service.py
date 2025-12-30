import uuid
from collections.abc import Sequence
from typing import Literal
from uuid import UUID

import stripe as stripe_lib
import structlog
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.dispute.repository import DisputeRepository
from polar.enums import PaymentProcessor
from polar.event.service import event as event_service
from polar.event.system import OrderRefundedMetadata, SystemEvent, build_system_event
from polar.exceptions import PolarError, PolarRequestValidationError, ResourceNotFound
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.logging import Logger
from polar.models import (
    Dispute,
    Order,
    Organization,
    Payment,
    Transaction,
    User,
)
from polar.models.dispute import DisputeAlertProcessor
from polar.models.order import RefundAmountTooHigh
from polar.models.refund import Refund, RefundFailureReason, RefundReason, RefundStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.payment.repository import PaymentRepository
from polar.transaction.service.refund import (
    RefundTransactionAlreadyExistsError,
    RefundTransactionDoesNotExistError,
)
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)
from polar.wallet.service import wallet as wallet_service
from polar.webhook.service import webhook as webhook_service

from .repository import RefundRepository
from .schemas import RefundCreate
from .sorting import RefundSortProperty

log: Logger = structlog.get_logger()


class RefundError(PolarError): ...


class RefundUnknownPayment(ResourceNotFound):
    def __init__(
        self, id: str | UUID, payment_type: Literal["charge", "order", "pledge"]
    ) -> None:
        self.id = id
        message = f"Refund issued for unknown {payment_type}: {id}"
        super().__init__(message, 404)


class RefundedAlready(RefundError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = f"Order is already fully refunded: {order.id}"
        super().__init__(message, 403)


class RefundPendingCreation(RefundError):
    def __init__(self, refund_id: UUID) -> None:
        self.refund_id = refund_id
        message = f"Refund is pending creation: {refund_id}"
        super().__init__(message, 409)


class RevokeSubscriptionBenefitsProhibited(RefundError):
    def __init__(self) -> None:
        message = "Subscription benefits can only be revoked upon cancellation"
        super().__init__(message, 400)


class RefundsBlocked(RefundError):
    def __init__(self, order: Order) -> None:
        self.order = order
        message = f"Refunds are blocked for order: {order.id}"
        super().__init__(message, 403)


class MissingRelatedDispute(RefundError):
    def __init__(self, id: str, related_dispute_id: str) -> None:
        self.id = id
        self.related_dispute_id = related_dispute_id
        message = f"Refund {id} is missing related dispute {related_dispute_id}"
        super().__init__(message)


class RefundService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        id: Sequence[UUID] | None = None,
        organization_id: Sequence[UUID] | None = None,
        order_id: Sequence[UUID] | None = None,
        subscription_id: Sequence[UUID] | None = None,
        customer_id: Sequence[UUID] | None = None,
        succeeded: bool | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[RefundSortProperty]] = [
            (RefundSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Refund], int]:
        repository = RefundRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if id is not None:
            statement = statement.where(Refund.id.in_(id))

        if organization_id is not None:
            statement = statement.where(Refund.organization_id.in_(organization_id))

        if order_id is not None:
            statement = statement.where(Refund.order_id.in_(order_id))

        if subscription_id is not None:
            statement = statement.where(Refund.subscription_id.in_(subscription_id))

        if customer_id is not None:
            statement = statement.where(Refund.customer_id.in_(customer_id))

        if succeeded is not None:
            if succeeded:
                statement = statement.where(Refund.status == RefundStatus.succeeded)
            else:
                statement = statement.where(Refund.status != RefundStatus.succeeded)

        statement = repository.apply_sorting(statement, sorting).options(
            *repository.get_eager_options()
        )

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def user_create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: RefundCreate,
    ) -> Refund:
        order_repository = OrderRepository.from_session(session)
        order = await order_repository.get_one_or_none(
            order_repository.get_readable_statement(auth_subject)
            .where(Order.id == create_schema.order_id)
            .options(*order_repository.get_eager_options())
        )
        if not order:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "order_id"),
                        "msg": "Order not found",
                        "input": create_schema.order_id,
                    }
                ]
            )

        try:
            return await self.create(session, order, create_schema=create_schema)
        except RefundAmountTooHigh as e:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "amount"),
                        "msg": "Refund amount exceeds refundable amount",
                        "input": create_schema.amount,
                    }
                ]
            ) from e

    async def create(
        self, session: AsyncSession, order: Order, create_schema: RefundCreate
    ) -> Refund:
        repository = RefundRepository.from_session(session)

        if order.refunds_blocked:
            raise RefundsBlocked(order)

        if order.refunded:
            raise RefundedAlready(order)

        is_subscription = order.subscription_id is not None
        if create_schema.revoke_benefits and is_subscription:
            raise RevokeSubscriptionBenefitsProhibited()

        refund_amount = create_schema.amount
        refund_tax_amount = order.calculate_refunded_tax_from_subtotal(
            create_schema.amount
        )
        refund_id: UUID = uuid.uuid4()

        payment_repository = PaymentRepository.from_session(session)
        payment = await payment_repository.get_succeeded_by_order(order.id)
        if payment is None:
            raise RefundUnknownPayment(order.id, payment_type="order")

        if payment.processor == PaymentProcessor.stripe:
            refund_total = refund_amount + refund_tax_amount
            stripe_metadata = dict(
                refund_id=str(refund_id),
                order_id=str(order.id),
                charge_id=payment.processor_id,
                amount=str(create_schema.amount),
                refund_amount=str(refund_amount),
                refund_tax_amount=str(refund_tax_amount),
                revoke_benefits="1" if create_schema.revoke_benefits else "0",
            )
            try:
                stripe_refund = await stripe_service.create_refund(
                    charge_id=payment.processor_id,
                    amount=refund_total,
                    reason=RefundReason.to_stripe(create_schema.reason),
                    metadata=stripe_metadata,
                )
            except stripe_lib.InvalidRequestError as e:
                if e.code == "charge_already_refunded":
                    log.warning("refund.attempted_already_refunded", order_id=order.id)
                    raise RefundedAlready(order)
                else:
                    raise e

            refund = Refund.from_stripe(stripe_refund, order, payment)
        else:
            raise NotImplementedError()

        refund.reason = create_schema.reason
        refund.comment = create_schema.comment
        refund.revoke_benefits = create_schema.revoke_benefits
        refund.user_metadata = create_schema.metadata
        refund = await repository.create(refund, flush=True)

        await self._on_created(session, refund)

        return refund

    async def upsert_from_stripe(
        self, session: AsyncSession, stripe_refund: stripe_lib.Refund
    ) -> Refund:
        repository = RefundRepository.from_session(session)
        order_repository = OrderRepository.from_session(session)
        refund = await repository.get_by_processor_id(
            stripe_refund.id,
            options=repository.get_eager_options(
                order_options=order_repository.get_eager_options()
            ),
        )

        if refund is not None:
            return await self.update_from_stripe(session, refund, stripe_refund)

        if stripe_refund.metadata and stripe_refund.metadata.get("refund_id"):
            raise RefundPendingCreation(
                uuid.UUID(stripe_refund.metadata.get("refund_id"))
            )

        return await self.create_from_stripe(session, stripe_refund)

    async def create_from_stripe(
        self,
        session: AsyncSession,
        stripe_refund: stripe_lib.Refund,
    ) -> Refund:
        repository = RefundRepository.from_session(session)
        order, payment = await self._get_resources(session, stripe_refund)

        refund = Refund.from_stripe(stripe_refund, order, payment)

        # Check if there are disputes to link
        dispute_repository = DisputeRepository.from_session(session)
        dispute: Dispute | None = None
        if stripe_refund.metadata and (
            alert_id := stripe_refund.metadata.get("cbs_related_alert_id")
        ):
            dispute = await dispute_repository.get_by_alert_processor_id(
                DisputeAlertProcessor.chargeback_stop, alert_id
            )
            # Dispute is missing, raise error, the task will be retried later
            if dispute is None:
                raise MissingRelatedDispute(stripe_refund.id, alert_id)

            refund.dispute = dispute
            refund.reason = RefundReason.dispute_prevention

        refund = await repository.create(refund, flush=True)

        await self._on_created(session, refund)

        return refund

    async def update_from_stripe(
        self,
        session: AsyncSession,
        refund: Refund,
        stripe_refund: stripe_lib.Refund,
    ) -> Refund:
        repository = RefundRepository.from_session(session)
        had_succeeded = refund.succeeded

        # Reference: https://docs.stripe.com/refunds#see-also
        # Only `metadata` and `destination_details` should update according to
        # docs, but a pending refund can surely become `succeeded`, `canceled` or `failed`
        refund = await repository.update(
            refund,
            update_dict={
                "status": RefundStatus(stripe_refund.status)
                if stripe_refund.status
                else refund.status,
                "failure_reason": RefundFailureReason.from_stripe(
                    getattr(stripe_refund, "failure_reason", None)
                ),
                "destination_details": getattr(
                    stripe_refund, "destination_details", {}
                ),
                "processor_receipt_number": stripe_refund.receipt_number,
            },
        )
        await self._on_updated(session, refund)

        transitioned_to_succeeded = refund.succeeded and not had_succeeded
        if transitioned_to_succeeded:
            await self._on_succeeded(session, refund)

        reverted = had_succeeded and refund.status in {
            RefundStatus.canceled,
            RefundStatus.failed,
        }
        if reverted:
            await self._revert_refund_transaction(session, refund)

        return refund

    async def create_from_dispute(
        self,
        session: AsyncSession,
        dispute: Dispute,
        processor_balance_transaction_id: str,
    ) -> Refund:
        repository = RefundRepository.from_session(session)

        assert dispute.payment_processor is not None
        assert dispute.payment_processor_id is not None

        order_repository = OrderRepository.from_session(session)
        order = await order_repository.get_by_id(
            dispute.order_id, options=order_repository.get_eager_options()
        )
        assert order is not None
        payment_repository = PaymentRepository.from_session(session)
        payment = await payment_repository.get_by_id(dispute.payment_id)
        assert payment is not None

        refund = await repository.create(
            Refund(
                status=RefundStatus.succeeded,
                reason=RefundReason.dispute_prevention,
                amount=dispute.amount,
                tax_amount=dispute.tax_amount,
                currency=dispute.currency,
                failure_reason=None,
                payment=payment,
                order=order,
                subscription=None,
                customer=order.customer,
                organization=order.organization,
                pledge=None,
                dispute=dispute,
                processor=dispute.payment_processor,
                processor_id=dispute.payment_processor_id,
                processor_receipt_number=None,
                processor_reason="other",
                processor_balance_transaction_id=processor_balance_transaction_id,
                revoke_benefits=True,
            ),
            flush=True,
        )

        await self._on_created(session, refund)

        return refund

    async def _on_created(self, session: AsyncSession, refund: Refund) -> None:
        order = refund.order
        customer = refund.customer
        organization = refund.organization
        assert order is not None
        assert customer is not None
        assert organization is not None

        await webhook_service.send(
            session, organization, WebhookEventType.refund_created, refund
        )

        if refund.succeeded:
            await self._on_succeeded(session, refund)

        if refund.revoke_benefits and order.product is not None:
            await benefit_grant_service.enqueue_benefits_grants(
                session,
                task="revoke",
                customer=customer,
                product=order.product,
                order=order,
            )

    async def _create_refund_transaction(
        self, session: AsyncSession, refund: Refund
    ) -> Transaction | None:
        try:
            transaction = await refund_transaction_service.create(
                session, refund=refund
            )
        except RefundTransactionAlreadyExistsError:
            return None

        order = refund.order
        if order:
            await order_service.update_refunds(
                session,
                order,
                refunded_amount=refund.amount,
                refunded_tax_amount=refund.tax_amount,
            )

            # Revert the tax transaction in the tax processor ledger
            if (
                order.stripe_invoice_id is None  # Tax managed via Stripe Billing
                and order.tax_transaction_processor_id
                and order.tax_amount > 0
            ):
                if refund.total_amount >= order.total_amount:
                    tax_transaction_processor = (
                        await stripe_service.revert_tax_transaction(
                            order.tax_transaction_processor_id,
                            mode="full",
                            reference=str(refund.id),
                        )
                    )
                else:
                    tax_transaction_processor = (
                        await stripe_service.revert_tax_transaction(
                            order.tax_transaction_processor_id,
                            mode="partial",
                            reference=str(refund.id),
                            amount=-refund.total_amount,
                        )
                    )
                refund.tax_transaction_processor_id = tax_transaction_processor.id
                session.add(refund)

        return transaction

    async def _revert_refund_transaction(
        self, session: AsyncSession, refund: Refund
    ) -> None:
        try:
            await refund_transaction_service.revert(session, refund)
        except RefundTransactionDoesNotExistError:
            return None

        order = refund.order
        if order:
            await order_service.update_refunds(
                session,
                order,
                refunded_amount=-refund.amount,
                refunded_tax_amount=-refund.tax_amount,
            )

    async def _on_succeeded(
        self,
        session: AsyncSession,
        refund: Refund,
    ) -> None:
        await self._create_refund_transaction(session, refund)

        order = refund.order
        if order is not None:
            # Reduce positive customer balance
            customer_balance = await wallet_service.get_billing_wallet_balance(
                session, order.customer, order.currency
            )
            if customer_balance > 0:
                reduction_amount = min(
                    customer_balance, order.refunded_amount + order.refunded_tax_amount
                )
                await wallet_service.create_balance_transaction(
                    session,
                    order.customer,
                    -reduction_amount,
                    order.currency,
                    order=order,
                )

            await event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.order_refunded,
                    customer=order.customer,
                    organization=order.organization,
                    metadata=OrderRefundedMetadata(
                        order_id=str(order.id),
                        refunded_amount=order.refunded_amount,
                        currency=order.currency,
                    ),
                ),
            )

            # Send order.refunded
            await webhook_service.send(
                session, order.organization, WebhookEventType.order_refunded, order
            )

    async def _on_updated(self, session: AsyncSession, refund: Refund) -> None:
        if refund.organization is not None:
            await webhook_service.send(
                session, refund.organization, WebhookEventType.refund_updated, refund
            )

    async def _get_resources(
        self, session: AsyncSession, refund: stripe_lib.Refund
    ) -> tuple[Order, Payment]:
        if refund.charge is None:
            raise RefundUnknownPayment(refund.id, payment_type="charge")

        charge_id = get_expandable_id(refund.charge)

        payment_repository = PaymentRepository.from_session(session)
        order_repository = OrderRepository.from_session(session)
        payment = await payment_repository.get_by_processor_id(
            PaymentProcessor.stripe,
            charge_id,
            options=(
                joinedload(Payment.order).options(
                    *order_repository.get_eager_options()  # type: ignore
                ),
            ),
        )
        if payment is None:
            raise RefundUnknownPayment(charge_id, payment_type="charge")

        if payment.order is None:
            raise RefundUnknownPayment(payment.id, payment_type="order")

        return payment.order, payment


refund = RefundService()
