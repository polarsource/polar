from collections.abc import Sequence
from typing import Literal, TypeAlias
from uuid import UUID

import stripe as stripe_lib
import structlog
from sqlalchemy.dialects import postgresql

from polar.auth.models import AuthSubject
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.customer.repository import CustomerRepository
from polar.dispute.repository import DisputeRepository
from polar.event.service import event as event_service
from polar.event.system import OrderRefundedMetadata, SystemEvent, build_system_event
from polar.exceptions import PolarError, PolarRequestValidationError, ResourceNotFound
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    Dispute,
    Order,
    Organization,
    Pledge,
    Transaction,
    User,
)
from polar.models.dispute import DisputeAlertProcessor
from polar.models.refund import Refund, RefundReason, RefundStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.organization.repository import OrganizationRepository
from polar.payment.repository import PaymentRepository
from polar.pledge.service import pledge as pledge_service
from polar.transaction.repository import PaymentTransactionRepository
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
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
from .schemas import InternalRefundCreate, RefundCreate
from .sorting import RefundSortProperty

log: Logger = structlog.get_logger()

ChargeID: TypeAlias = str
RefundTransaction: TypeAlias = Transaction
RefundedResources: TypeAlias = tuple[
    ChargeID, RefundTransaction, Order | None, Pledge | None
]
Created: TypeAlias = bool
FullRefund: TypeAlias = bool


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

        statement = repository.apply_sorting(statement, sorting)

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

        return await self.create(session, order, create_schema=create_schema)

    async def create(
        self,
        session: AsyncSession,
        order: Order,
        create_schema: RefundCreate,
    ) -> Refund:
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
        payment = await payment_transaction_service.get_by_order_id(session, order.id)
        if not (payment and payment.charge_id):
            raise RefundUnknownPayment(order.id, payment_type="order")

        refund_total = refund_amount + refund_tax_amount
        stripe_metadata = dict(
            order_id=str(order.id),
            charge_id=str(payment.charge_id),
            amount=str(create_schema.amount),
            refund_amount=str(refund_amount),
            refund_tax_amount=str(refund_tax_amount),
            revoke_benefits="1" if create_schema.revoke_benefits else "0",
        )

        try:
            stripe_refund = await stripe_service.create_refund(
                charge_id=payment.charge_id,
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

        internal_create_schema = self.build_create_schema_from_stripe(
            stripe_refund,
            order=order,
        )
        internal_create_schema.reason = create_schema.reason
        internal_create_schema.comment = create_schema.comment
        internal_create_schema.revoke_benefits = create_schema.revoke_benefits
        internal_create_schema.metadata = create_schema.metadata
        refund = await self._create(
            session,
            internal_create_schema,
            charge_id=payment.charge_id,
            payment=payment,
            order=order,
        )

        if refund.revoke_benefits:
            await self.enqueue_benefits_revokation(session, order)

        return refund

    async def upsert_from_stripe(
        self, session: AsyncSession, stripe_refund: stripe_lib.Refund
    ) -> Refund:
        repository = RefundRepository.from_session(session)
        refund = await repository.get_by_processor_id(stripe_refund.id)
        if refund:
            return await self.update_from_stripe(session, refund, stripe_refund)
        return await self.create_from_stripe(session, stripe_refund)

    async def create_from_stripe(
        self,
        session: AsyncSession,
        stripe_refund: stripe_lib.Refund,
    ) -> Refund:
        resources = await self._get_resources(session, stripe_refund)
        charge_id, payment, order, pledge = resources

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

        internal_create_schema = self.build_create_schema_from_stripe(
            stripe_refund,
            order=order,
            pledge=pledge,
            dispute=dispute,
        )

        return await self._create(
            session,
            internal_create_schema,
            charge_id=charge_id,
            payment=payment,
            order=order,
            pledge=pledge,
        )

    async def update_from_stripe(
        self,
        session: AsyncSession,
        refund: Refund,
        stripe_refund: stripe_lib.Refund,
    ) -> Refund:
        resources = await self._get_resources(session, stripe_refund)
        charge_id, payment, order, pledge = resources
        updated = self.build_create_schema_from_stripe(
            stripe_refund,
            order=order,
            pledge=pledge,
        )

        had_succeeded = refund.succeeded

        # Reference: https://docs.stripe.com/refunds#see-also
        # Only `metadata` and `destination_details` should update according to
        # docs, but a pending refund can surely become `succeeded`, `canceled` or `failed`
        refund.status = updated.status
        refund.failure_reason = updated.failure_reason
        refund.destination_details = updated.destination_details
        refund.processor_receipt_number = updated.processor_receipt_number
        session.add(refund)

        transitioned_to_succeeded = refund.succeeded and not had_succeeded

        if transitioned_to_succeeded:
            refund_transaction = await self._create_refund_transaction(
                session,
                charge_id=charge_id,
                refund=refund,
                payment=payment,
                order=order,
                pledge=pledge,
            )
            # Double check transition by ensuring ledger entry was made
            transitioned_to_succeeded = refund_transaction is not None

        reverted = had_succeeded and refund.status in {
            RefundStatus.canceled,
            RefundStatus.failed,
        }
        if reverted:
            await self._revert_refund_transaction(
                session,
                charge_id=charge_id,
                refund=refund,
                payment=payment,
                order=order,
                pledge=pledge,
            )

        await session.flush()
        log.info(
            "refund.updated",
            id=refund.id,
            amount=refund.amount,
            tax_amount=refund.tax_amount,
            order_id=refund.order_id,
            reason=refund.reason,
            processor=refund.processor,
            processor_id=refund.processor_id,
        )
        if order is None:
            return refund

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(order.organization.id)
        if organization is None:
            return refund

        await self._on_updated(session, organization, refund)
        if transitioned_to_succeeded:
            await self._on_succeeded(session, organization, order)
        return refund

    async def create_from_dispute(
        self,
        session: AsyncSession,
        dispute: Dispute,
        processor_balance_transaction_id: str,
    ) -> Refund:
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

        internal_create_schema = InternalRefundCreate(
            status=RefundStatus.succeeded,
            reason=RefundReason.dispute_prevention,
            amount=dispute.amount,
            tax_amount=dispute.tax_amount,
            currency=dispute.currency,
            failure_reason=None,
            order_id=order.id,
            subscription_id=None,
            customer_id=order.customer_id,
            organization_id=order.organization.id,
            pledge_id=None,
            dispute_id=dispute.id,
            processor=dispute.payment_processor,
            processor_id=dispute.payment_processor_id,
            processor_receipt_number=None,
            processor_reason="other",
            processor_balance_transaction_id=processor_balance_transaction_id,
        )

        payment_transaction_repository = PaymentTransactionRepository.from_session(
            session
        )
        payment_transaction = await payment_transaction_repository.get_by_payment_id(
            dispute.payment_id
        )
        assert payment_transaction is not None

        return await self._create(
            session,
            internal_create_schema,
            charge_id=payment.processor_id,
            payment=payment_transaction,
            order=order,
        )

    async def enqueue_benefits_revokation(
        self, session: AsyncSession, order: Order
    ) -> None:
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(
            order.customer_id, include_deleted=True
        )
        if customer is None:
            return

        if not order.product:
            return

        await benefit_grant_service.enqueue_benefits_grants(
            session,
            task="revoke",
            customer=customer,
            product=order.product,
            order=order,
        )

    def build_create_schema_from_stripe(
        self,
        stripe_refund: stripe_lib.Refund,
        *,
        order: Order | None = None,
        pledge: Pledge | None = None,
        dispute: Dispute | None = None,
    ) -> InternalRefundCreate:
        order_id = None
        subscription_id = None
        customer_id = None
        organization_id = None
        refunded_amount = stripe_refund.amount
        refunded_tax_amount = 0  # Default since pledges don't have VAT
        pledge_id = pledge.id if pledge else None

        if order:
            order_id = order.id
            subscription_id = order.subscription_id
            customer_id = order.customer_id
            organization_id = order.organization.id
            refunded_amount, refunded_tax_amount = (
                order.calculate_refunded_tax_from_total(stripe_refund.amount)
            )

        schema = InternalRefundCreate.from_stripe(
            stripe_refund,
            refunded_amount=refunded_amount,
            refunded_tax_amount=refunded_tax_amount,
            order_id=order_id,
            subscription_id=subscription_id,
            customer_id=customer_id,
            organization_id=organization_id,
            pledge_id=pledge_id,
            dispute_id=dispute.id if dispute else None,
        )
        return schema

    def build_instance_from_stripe(
        self,
        stripe_refund: stripe_lib.Refund,
        *,
        order: Order | None = None,
        pledge: Pledge | None = None,
    ) -> Refund:
        internal_create_schema = self.build_create_schema_from_stripe(
            stripe_refund,
            order=order,
            pledge=pledge,
        )
        instance = Refund(**internal_create_schema.model_dump())
        return instance

    ###############################################################################
    # INTERNALS
    ###############################################################################

    async def _create(
        self,
        session: AsyncSession,
        internal_create_schema: InternalRefundCreate,
        *,
        charge_id: str,
        payment: Transaction,
        order: Order | None = None,
        pledge: Pledge | None = None,
    ) -> Refund:
        # Upsert to handle race condition from Stripe `refund.created`.
        # Could be fired standalone from manual support operations in Stripe dashboard.
        statement = (
            postgresql.insert(Refund)
            .values(**internal_create_schema.model_dump(by_alias=True))
            .on_conflict_do_update(
                index_elements=[Refund.processor_id],
                # Only update `modified_at` as race conditions from API &
                # webhook creation should only contain the same data.
                set_=dict(
                    modified_at=utc_now(),
                ),
            )
            .returning(Refund)
            .execution_options(populate_existing=True)
        )
        res = await session.execute(statement)
        instance = res.scalars().one()
        # Avoid processing creation twice, i.e updated vs. inserted
        if instance.modified_at:
            return instance

        if instance.succeeded:
            await self._create_refund_transaction(
                session,
                charge_id=charge_id,
                refund=instance,
                payment=payment,
                order=order,
                pledge=pledge,
            )

        await session.flush()
        log.info(
            "refund.create",
            id=instance.id,
            amount=instance.amount,
            tax_amount=instance.tax_amount,
            order_id=instance.order_id,
            pledge_id=instance.pledge_id,
            reason=instance.reason,
            processor=instance.processor,
            processor_id=instance.processor_id,
        )
        if order is None:
            return instance

        organization = order.organization

        await self._on_created(session, organization, instance)
        if instance.succeeded:
            await self._on_succeeded(session, organization, order)
        return instance

    async def _create_refund_transaction(
        self,
        session: AsyncSession,
        *,
        charge_id: str,
        refund: Refund,
        payment: Transaction,
        order: Order | None = None,
        pledge: Pledge | None = None,
    ) -> Transaction | None:
        try:
            transaction = await refund_transaction_service.create(
                session,
                charge_id=charge_id,
                payment_transaction=payment,
                refund=refund,
            )
        except RefundTransactionAlreadyExistsError:
            return None

        if order:
            await order_service.update_refunds(
                session,
                order,
                refunded_amount=refund.amount,
                refunded_tax_amount=refund.tax_amount,
            )

            # Send order.updated webhook
            await order_service.send_webhook(
                session, order, WebhookEventType.order_updated
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

        elif pledge and pledge.payment_id and payment.charge_id:
            await pledge_service.refund_by_payment_id(
                session=session,
                payment_id=pledge.payment_id,
                amount=refund.amount,
                transaction_id=payment.charge_id,
            )

        return transaction

    async def _revert_refund_transaction(
        self,
        session: AsyncSession,
        *,
        charge_id: str,
        refund: Refund,
        payment: Transaction,
        order: Order | None = None,
        pledge: Pledge | None = None,
    ) -> None:
        try:
            transaction = await refund_transaction_service.revert(
                session,
                charge_id=charge_id,
                payment_transaction=payment,
                refund=refund,
            )
        except RefundTransactionDoesNotExistError:
            return None

        if order:
            await order_service.update_refunds(
                session,
                order,
                refunded_amount=-refund.amount,
                refunded_tax_amount=-refund.tax_amount,
            )

            # Send order.updated webhook
            await order_service.send_webhook(
                session, order, WebhookEventType.order_updated
            )

    async def _on_created(
        self,
        session: AsyncSession,
        organization: Organization,
        refund: Refund,
    ) -> None:
        await webhook_service.send(
            session, organization, WebhookEventType.refund_created, refund
        )

    async def _on_succeeded(
        self,
        session: AsyncSession,
        organization: Organization,
        order: Order,
    ) -> None:
        # Reduce positive customer balance
        customer_balance = await wallet_service.get_billing_wallet_balance(
            session, order.customer, order.currency
        )
        if customer_balance > 0:
            reduction_amount = min(
                customer_balance, order.refunded_amount + order.refunded_tax_amount
            )
            await wallet_service.create_balance_transaction(
                session, order.customer, -reduction_amount, order.currency, order=order
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
            session, organization, WebhookEventType.order_refunded, order
        )

    async def _on_updated(
        self,
        session: AsyncSession,
        organization: Organization,
        refund: Refund,
    ) -> None:
        await webhook_service.send(
            session, organization, WebhookEventType.refund_updated, refund
        )

    async def _get_resources(
        self,
        session: AsyncSession,
        refund: stripe_lib.Refund,
    ) -> RefundedResources:
        if not refund.charge:
            raise RefundUnknownPayment(refund.id, payment_type="charge")

        charge_id = str(refund.charge)
        payment_intent = str(refund.payment_intent) if refund.payment_intent else None
        payment = await payment_transaction_service.get_by_charge_id(session, charge_id)
        if payment is None:
            raise RefundUnknownPayment(charge_id, payment_type="charge")

        if payment.order_id:
            order_repository = OrderRepository.from_session(session)
            order = await order_repository.get_by_id(
                payment.order_id, options=order_repository.get_eager_options()
            )
            if not order:
                raise RefundUnknownPayment(payment.order_id, payment_type="order")

            return (charge_id, payment, order, None)

        if not (payment.pledge_id and payment_intent):
            raise RefundUnknownPayment(payment.id, payment_type="charge")

        pledge = await pledge_service.get_by_payment_id(
            session,
            payment_id=payment_intent,
        )
        if pledge is None:
            raise RefundUnknownPayment(payment.pledge_id, payment_type="pledge")

        return (charge_id, payment, None, pledge)


refund = RefundService()
