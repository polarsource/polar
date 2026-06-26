import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import assert_never

import stripe as stripe_lib
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.customer.repository import CustomerRepository
from polar.dispute.dispute_case import dispute_case as dispute_case_service
from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.chargeback_stop.types import ChargebackStopAlert
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Dispute, Order, Payment
from polar.models.dispute import DisputeAlertProcessor, DisputeStatus
from polar.payment.repository import PaymentRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository
from polar.refund.service import refund as refund_service
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
from polar.transaction.service.dispute import (
    dispute_transaction as dispute_transaction_service,
)

from .repository import DisputeRepository
from .sorting import DisputeSortProperty
from .stripe import get_dispute_balance_transaction, is_rapid_resolution_dispute


class DisputeError(PolarError):
    pass


class DisputePaymentNotFoundError(DisputeError):
    def __init__(self, processor: PaymentProcessor, processor_id: str) -> None:
        self.processor = processor
        self.processor_id = processor_id
        message = (
            f"Dispute payment not found for processor {processor} "
            f"and processor_id {processor_id}."
        )
        super().__init__(message)


class DisputeNotOpenError(DisputeError):
    def __init__(self, dispute_id: uuid.UUID) -> None:
        self.dispute_id = dispute_id
        super().__init__(f"Dispute {dispute_id} is not awaiting a response.", 409)


class DisputeService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        order_id: Sequence[uuid.UUID] | None = None,
        status: Sequence[DisputeStatus] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[DisputeSortProperty]] = [
            (DisputeSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Dispute], int]:
        repository = DisputeRepository.from_session(session)
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.sales_read
        )
        statement = repository.get_statement_by_org_ids(org_ids).options(
            *repository.get_eager_options()
        )

        if organization_id is not None:
            statement = statement.where(Payment.organization_id.in_(organization_id))

        if order_id is not None:
            statement = statement.where(Dispute.order_id.in_(order_id))

        if status is not None:
            statement = statement.where(Dispute.status.in_(status))

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Dispute | None:
        repository = DisputeRepository.from_session(session)
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.sales_read
        )
        statement = (
            repository.get_statement_by_org_ids(org_ids)
            .options(*repository.get_eager_options())
            .where(Dispute.id == id)
        )
        return await repository.get_one_or_none(statement)

    async def accept(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Dispute | None:
        """Merchant concedes the chargeback: log it on the dispute's support
        case so staff can settle it. Requires ``sales:manage`` on the org."""
        repository = DisputeRepository.from_session(session)
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.sales_manage
        )
        statement = (
            repository.get_statement_by_org_ids(org_ids)
            .options(*repository.get_eager_options())
            .where(Dispute.id == id)
        )
        dispute = await repository.get_one_or_none(statement)
        if dispute is None:
            return None

        if dispute.accepted_at is not None:
            return dispute

        if dispute.status != DisputeStatus.needs_response:
            raise DisputeNotOpenError(dispute.id)

        await repository.update(
            dispute,
            update_dict={
                "status": DisputeStatus.accepted,
                "accepted_at": datetime.now(UTC),
            },
        )

        case = await dispute_case_service.get_case(session, dispute)
        if case is not None:
            actor = auth_subject.subject if is_user(auth_subject) else None
            await dispute_case_service.accept(session, case, actor=actor)

        return await repository.get_one_or_none(statement)

    async def upsert_from_stripe(
        self, session: AsyncSession, stripe_dispute: stripe_lib.Dispute
    ) -> Dispute:
        repository = DisputeRepository.from_session(session)
        charge_id = get_expandable_id(stripe_dispute.charge)

        # First try to find by Stripe Dispute ID
        dispute = await repository.get_by_payment_processor_dispute_id(
            PaymentProcessor.stripe,
            stripe_dispute.id,
            options=repository.get_eager_options(),
        )
        # Then try to find by matching payment info, in case we got a ChargebackStop alert first
        from_alert = False
        if dispute is None:
            dispute = await repository.get_matching_by_dispute_alert(
                PaymentProcessor.stripe,
                charge_id,
                stripe_dispute.amount,
                stripe_dispute.currency,
                options=repository.get_eager_options(),
            )
            from_alert = dispute is not None

        if dispute is None:
            payment, order = await self._get_payment_and_order_from_processor_id(
                session, PaymentProcessor.stripe, charge_id
            )
            amount, tax_amount = order.calculate_refunded_tax_from_total(
                stripe_dispute.amount
            )
            dispute = await repository.create(
                Dispute(
                    amount=amount,
                    tax_amount=tax_amount,
                    currency=stripe_dispute.currency,
                    order=order,
                    payment=payment,
                )
            )

        was_closed = dispute.closed
        previous_status = dispute.status
        dispute.payment_processor = PaymentProcessor.stripe
        dispute.payment_processor_id = stripe_dispute.id

        # Capture what Stripe expects in response, and the submission state it
        # reports back (kept current by every `charge.dispute.updated` event).
        # Stripe omits null optional fields from the payload, and the SDK raises
        # AttributeError on a missing key — so read those via `.get()`.
        evidence_details = stripe_dispute.evidence_details
        due_by = evidence_details.get("due_by")
        dispute.reason = stripe_dispute.reason
        dispute.network_reason_code = stripe_dispute.get("network_reason_code")
        dispute.evidence_due_by = (
            datetime.fromtimestamp(due_by, tz=UTC) if due_by else None
        )
        dispute.has_evidence = evidence_details.has_evidence
        dispute.past_due = evidence_details.past_due
        dispute.submission_count = evidence_details.submission_count

        new_status = DisputeStatus.from_stripe(stripe_dispute.status)

        # Dispute that we tried to prevent but too late: we need to reopen it
        # The associated refund will be marked as failed through refund.failed
        if (
            dispute.status == DisputeStatus.prevented
            and new_status not in DisputeStatus.closed_statuses()
        ):
            dispute.status = new_status
        # ⚠️ If the dispute is handled via Verifi RDR network, Stripe will see
        # it as a "lost" dispute, even if we issued a refund through ChargebackStop.
        # Detect this case, keep the dispute as "prevented", and create a refund.
        elif new_status in DisputeStatus.closed_statuses() and (
            dispute.status == DisputeStatus.prevented
            or is_rapid_resolution_dispute(stripe_dispute)
        ):
            dispute.status = DisputeStatus.prevented
            if from_alert or not was_closed:  # Make sure we didn't already handle it
                balance_transaction = get_dispute_balance_transaction(stripe_dispute)
                assert balance_transaction is not None
                await session.flush()
                await refund_service.create_from_dispute(
                    session, dispute, balance_transaction.id
                )
                await self._revoke(session, dispute)
        elif not was_closed:
            dispute.status = new_status
            # If won or lost, record the transactions
            if dispute.resolved:
                await dispute_transaction_service.create_dispute(
                    session, dispute=dispute
                )
                await self._revoke(session, dispute)

        dispute = await repository.update(dispute)
        await self._sync_support_case(session, dispute, previous_status=previous_status)
        return dispute

    async def _sync_support_case(
        self,
        session: AsyncSession,
        dispute: Dispute,
        *,
        previous_status: DisputeStatus | None,
    ) -> None:
        """Reconcile the merchant support case with the dispute's status.

        Opens the case the first time the dispute needs a response, posts the
        milestone for each terminal status (under review, won, lost, prevented)
        and closes it on resolution. Idempotent: opening is guarded by the
        existing case, the terminal milestones by the case being open, and the
        (non-closing) under-review milestone by an actual status change — so
        retried webhooks are no-ops.
        """
        case = await dispute_case_service.get_case(session, dispute)

        # Open (or reopen) the case the first time the dispute needs a response.
        if dispute.status == DisputeStatus.needs_response:
            if case is None:
                await dispute_case_service.open_case(
                    session, dispute, organization=dispute.payment.organization
                )
            elif not await dispute_case_service.is_open(session, case):
                # Dispute reopened after we'd closed the case (e.g. a prevented
                # dispute that Stripe escalated back to needs_response).
                await dispute_case_service.reopen(session, case)
            return

        # Every other transition only acts on an already-open case.
        if case is None or not await dispute_case_service.is_open(session, case):
            return

        match dispute.status:
            case DisputeStatus.under_review:
                # Skip the no-op repost when a retried webhook doesn't change it.
                if dispute.status != previous_status:
                    await dispute_case_service.mark_under_review(session, case)
            case DisputeStatus.won | DisputeStatus.lost:
                await dispute_case_service.resolve(
                    session, case, won=dispute.status == DisputeStatus.won
                )
            case DisputeStatus.prevented:
                await dispute_case_service.prevent(session, case)
            case (
                DisputeStatus.needs_response
                | DisputeStatus.early_warning
                | DisputeStatus.accepted
            ):
                pass
            case _:
                assert_never(dispute.status)

    async def upsert_from_chargeback_stop(
        self, session: AsyncSession, alert: ChargebackStopAlert
    ) -> Dispute:
        repository = DisputeRepository.from_session(session)

        # ChargebackStop uses PaymentIntent ID, but we use Charge ID
        payment_intent_id = alert["integration_transaction_id"]
        payment_intent = await stripe_service.get_payment_intent(payment_intent_id)
        latest_charge = payment_intent.latest_charge
        assert latest_charge is not None
        charge_id = get_expandable_id(latest_charge)

        # First try to find by alert processor ID
        dispute = await repository.get_by_alert_processor_id(
            DisputeAlertProcessor.chargeback_stop,
            alert["id"],
            options=repository.get_eager_options(),
        )
        # Then try to find by matching payment info, in case Stripe already pinged us about the dispute
        if dispute is None:
            dispute = await repository.get_matching_by_dispute_alert(
                PaymentProcessor.stripe,
                charge_id,
                alert["transaction_amount_in_cents"],
                alert["transaction_currency_code"].lower(),
                options=repository.get_eager_options(),
            )

        if dispute is None:
            payment, order = await self._get_payment_and_order_from_processor_id(
                session, PaymentProcessor.stripe, charge_id
            )
            amount, tax_amount = order.calculate_refunded_tax_from_total(
                alert["transaction_amount_in_cents"]
            )
            dispute = await repository.create(
                Dispute(
                    amount=amount,
                    tax_amount=tax_amount,
                    currency=alert["transaction_currency_code"].lower(),
                    payment_processor=PaymentProcessor.stripe,
                    payment_processor_id=None,  # We don't know the dispute ID yet
                    order=order,
                    payment=payment,
                    status=DisputeStatus.early_warning,
                )
            )

        dispute.dispute_alert_processor = DisputeAlertProcessor.chargeback_stop
        dispute.dispute_alert_processor_id = alert["id"]

        # We refunded the transaction before the dispute could be escalated
        if alert["transaction_refund_outcome"] == "REFUNDED":
            dispute.status = DisputeStatus.prevented

        return await repository.update(dispute)

    async def _get_payment_and_order_from_processor_id(
        self, session: AsyncSession, processor: PaymentProcessor, processor_id: str
    ) -> tuple[Payment, Order]:
        payment_repository = PaymentRepository.from_session(session)
        payment = await payment_repository.get_by_processor_id(
            PaymentProcessor.stripe,
            processor_id,
            options=(joinedload(Payment.order), joinedload(Payment.organization)),
        )
        if payment is None or payment.order is None:
            raise DisputePaymentNotFoundError(processor, processor_id)
        return payment, payment.order

    async def _revoke(self, session: AsyncSession, dispute: Dispute) -> None:
        # Immediately cancel the subscription if applicable
        if dispute.order.subscription_id is not None:
            subscription_repository = SubscriptionRepository.from_session(session)
            subscription = await subscription_repository.get_by_id(
                dispute.order.subscription_id,
                options=subscription_repository.get_eager_options(),
            )
            assert subscription is not None
            if subscription.can_cancel(immediately=True):
                async with SubscriptionUpdateContext(
                    session, subscription, subscription_service
                ) as ctx:
                    await subscription_service.revoke(session, ctx, subscription)
        # Revoke the order benefits
        elif dispute.order.product_id is not None:
            product_repository = ProductRepository.from_session(session)
            product = await product_repository.get_by_id(
                dispute.order.product_id,
                options=product_repository.get_eager_options(),
            )
            assert product is not None
            customer_repository = CustomerRepository.from_session(session)
            customer = await customer_repository.get_by_id(dispute.order.customer_id)
            assert customer is not None
            await benefit_grant_service.enqueue_benefits_grants(
                session,
                task="revoke",
                customer=customer,
                product=product,
                order=dispute.order,
            )


dispute = DisputeService()
