from collections.abc import AsyncGenerator
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import contains_eager, joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.enums import PaymentProcessor
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Dispute, Order, Organization, Payment
from polar.models.dispute import DisputeAlertProcessor, DisputeStatus
from polar.models.support_case import (
    DisputeSupportCase,
    SupportCaseMessage,
    SupportCaseMessageType,
)

from .sorting import DisputeSortProperty


class DisputeRepository(
    RepositorySortingMixin[Dispute, DisputeSortProperty],
    RepositorySoftDeletionIDMixin[Dispute, UUID],
    RepositorySoftDeletionMixin[Dispute],
    RepositoryBase[Dispute],
):
    model = Dispute

    async def get_or_create_from_stripe(
        self,
        *,
        stripe_dispute_id: str,
        status: DisputeStatus,
        amount: int,
        tax_amount: int,
        currency: str,
        order: Order,
        payment: Payment,
    ) -> tuple[Dispute, bool]:
        statement = (
            pg_insert(Dispute)
            .values(
                payment_processor=PaymentProcessor.stripe,
                payment_processor_id=stripe_dispute_id,
                status=status,
                amount=amount,
                tax_amount=tax_amount,
                currency=currency,
                order_id=order.id,
                payment_id=payment.id,
            )
            .on_conflict_do_nothing(
                index_elements=["payment_processor", "payment_processor_id"]
            )
            .returning(Dispute.id)
        )
        inserted_id = await self.session.scalar(statement)

        dispute = await self.get_by_payment_processor_dispute_id(
            PaymentProcessor.stripe,
            stripe_dispute_id,
            options=(*self.get_eager_options(), joinedload(Dispute.payment)),
        )
        assert dispute is not None
        return dispute, inserted_id is not None

    async def get_by_payment_processor_dispute_id(
        self, processor: PaymentProcessor, processor_id: str, *, options: Options = ()
    ) -> Dispute | None:
        statement = (
            self.get_base_statement()
            .where(
                Dispute.payment_processor == processor,
                Dispute.payment_processor_id == processor_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_matching_by_dispute_alert(
        self,
        processor: PaymentProcessor,
        processor_payment_id: str,
        total_amount: int,
        currency: str,
        *,
        options: Options = (),
    ) -> Dispute | None:
        statement = (
            self.get_base_statement()
            .join(Dispute.payment)
            .where(
                Dispute.amount + Dispute.tax_amount == total_amount,
                Dispute.currency == currency,
                Payment.processor == processor,
                Payment.processor_id == processor_payment_id,
            )
            .options(contains_eager(Dispute.payment), *options)
            .order_by(Dispute.created_at.asc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def get_by_alert_processor_id(
        self,
        processor: DisputeAlertProcessor,
        processor_id: str,
        *,
        options: Options = (),
    ) -> Dispute | None:
        statement = (
            self.get_base_statement()
            .where(
                Dispute.dispute_alert_processor == processor,
                Dispute.dispute_alert_processor_id == processor_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Dispute]]:
        return (
            self.get_base_statement()
            .join(Dispute.payment)
            .options(contains_eager(Dispute.payment))
            .where(Payment.organization_id.in_(org_ids))
        )

    async def stream_auto_accept_candidates(
        self, *, before: datetime
    ) -> AsyncGenerator[Dispute, None]:
        """Disputes whose announced deadline has passed, on an opted-in
        organization."""
        feature_settings = Organization.feature_settings
        announced = (
            select(SupportCaseMessage.id)
            .join(
                DisputeSupportCase,
                DisputeSupportCase.id == SupportCaseMessage.case_id,
            )
            .where(
                DisputeSupportCase.dispute_id == Dispute.id,
                SupportCaseMessage.type
                == SupportCaseMessageType.dispute_auto_accept_scheduled,
                SupportCaseMessage.created_at < before,
            )
            .exists()
        )
        statement = (
            self.get_base_statement()
            .join(Order, Dispute.order_id == Order.id)
            .join(Organization, Order.organization_id == Organization.id)
            .where(
                Dispute.status == DisputeStatus.needs_response,
                announced,
                feature_settings["disputes_enabled"].as_boolean(),
                feature_settings["dispute_auto_accept_enabled"].as_boolean(),
                Organization.dispute_settings["auto_accept_below_amount"]
                .as_integer()
                .isnot(None),
            )
            .order_by(Dispute.created_at.asc())
        )
        async for dispute in self.stream(statement):
            yield dispute

    def get_eager_options(self) -> Options:
        return (
            joinedload(Dispute.order).joinedload(Order.organization),
            joinedload(Dispute.order).joinedload(Order.customer),
        )

    def get_sorting_clause(self, property: DisputeSortProperty) -> SortingClause:
        match property:
            case DisputeSortProperty.created_at:
                return Dispute.created_at
            case DisputeSortProperty.amount:
                return Dispute.amount
