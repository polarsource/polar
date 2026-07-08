from uuid import UUID

from sqlalchemy import Select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import joinedload

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
from polar.models import Dispute, Order, Payment
from polar.models.dispute import DisputeAlertProcessor, DisputeStatus

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

    async def lock_and_refresh_status(self, dispute: Dispute) -> None:
        """Lock the row and re-read status so concurrent dispute events serialize."""
        await self.session.refresh(
            dispute, attribute_names=["status"], with_for_update=True
        )

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
            .options(*options)
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
            .where(Payment.organization_id.in_(org_ids))
        )

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
