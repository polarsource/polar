from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import ColumnElement, Select, case, exists, func, or_, select
from sqlalchemy.orm import undefer

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    RepositoryBase,
    RepositoryExternalIDMixin,
    RepositoryIDMixin,
)
from polar.models import (
    Catalog,
    CustomerSeat,
    Meter,
    ProductPrice,
    Subscription,
    SubscriptionProductPrice,
)
from polar.models.catalog import CatalogStatus
from polar.models.customer_seat import SeatStatus
from polar.models.subscription import SubscriptionStatus


class MeterRepository(
    RepositoryExternalIDMixin[Meter],
    RepositoryBase[Meter],
    RepositoryIDMixin[Meter, UUID],
):
    model = Meter

    @staticmethod
    def get_active_clause() -> ColumnElement[bool]:
        """Meters that match events and bill: not archived, not deleted, and not
        a draft's new version, which only goes live when the draft is published."""
        in_draft = (
            select(Catalog.id)
            .where(
                Catalog.id == Meter.catalog_id, Catalog.status == CatalogStatus.draft
            )
            .exists()
        )
        return (
            Meter.archived_at.is_(None)
            & Meter.deleted_at.is_(None)
            & or_(Meter.is_current, ~in_draft)
        )

    def get_active_statement(self) -> Select[Meter]:
        return self.get_base_statement().where(self.get_active_clause())

    async def get_by_external_id_and_organization(
        self, external_id: str, organization_id: UUID
    ) -> Meter | None:
        statement = self.get_base_statement().where(
            Meter.external_id == external_id,
            Meter.organization_id == organization_id,
            Meter.is_current,
        )
        return await self.get_one_or_none(statement)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[Meter]:
        return self.get_base_statement().where(Meter.organization_id.in_(org_ids))

    async def get_readable_by_id(
        self,
        id: UUID,
        org_ids: set[AccessibleOrganizationID],
    ) -> Meter | None:
        statement = self.get_statement_by_org_ids(org_ids).where(Meter.id == id)
        return await self.get_one_or_none(statement)

    async def get_all_by_external_ids(
        self,
        organization_id: UUID,
        external_ids: Sequence[str],
        *,
        for_update: bool = False,
    ) -> Sequence[Meter]:
        statement = (
            self.get_base_statement()
            .where(
                Meter.organization_id == organization_id,
                Meter.external_id.in_(external_ids),
                Meter.deleted_at.is_(None),
                Meter.is_current,
            )
            .options(undefer(Meter.external_id))
        )
        if for_update:
            statement = statement.with_for_update()
        return await self.get_all(statement)

    async def get_external_ids_by_id(self, organization_id: UUID) -> dict[str, str]:
        """Map every meter version's ID to its `external_id`."""
        statement = select(Meter.id, Meter.external_id).where(
            Meter.organization_id == organization_id,
            Meter.external_id.is_not(None),
            Meter.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return {
            str(id): external_id
            for id, external_id in result.tuples()
            if external_id is not None
        }

    async def get_catalog_baseline(self, organization_id: UUID) -> Sequence[Meter]:
        statement = (
            self.get_base_statement()
            .where(
                Meter.organization_id == organization_id,
                Meter.external_id.is_not(None),
                Meter.deleted_at.is_(None),
                Meter.is_current,
            )
            .options(undefer(Meter.external_id))
        )
        return await self.get_all(statement)

    def get_organization_statement(self, organization_id: UUID) -> Select[Meter]:
        return (
            self.get_base_statement()
            .where(
                Meter.organization_id == organization_id,
                Meter.deleted_at.is_(None),
                Meter.is_current,
            )
            .order_by(Meter.created_at, Meter.id)
            .options(undefer(Meter.external_id))
        )

    async def get_billed_by_external_id(
        self, organization_id: UUID, external_id: str, customer_id: UUID
    ) -> Meter | None:
        """The version of the meter the customer's subscription, or the one they
        hold a claimed seat on, bills; or the current version when it bills none."""
        claimed_seat_subscriptions = select(CustomerSeat.subscription_id).where(
            CustomerSeat.customer_id == customer_id,
            CustomerSeat.status == SeatStatus.claimed,
        )
        billed = exists().where(
            SubscriptionProductPrice.subscription_id == Subscription.id,
            ProductPrice.id == SubscriptionProductPrice.product_price_id,
            ProductPrice.is_metered,
            # The subclass attribute would add a polymorphic filter and drop tiered prices.
            ProductPrice.__table__.c.meter_id == Meter.id,
            or_(
                Subscription.customer_id == customer_id,
                Subscription.id.in_(claimed_seat_subscriptions),
            ),
            Subscription.status.in_(SubscriptionStatus.billable_statuses()),
            ~Subscription.is_deleted,
            ~SubscriptionProductPrice.is_deleted,
        )
        statement = (
            self.get_base_statement()
            .where(
                Meter.organization_id == organization_id,
                Meter.external_id == external_id,
                Meter.deleted_at.is_(None),
                or_(Meter.is_current, billed),
            )
            .order_by(case((billed, 0), else_=1), Meter.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def count_billed_customers_by_external_ids(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> dict[str, int]:
        """Count the customers with a billable subscription billing any version
        of each external ID."""
        if not external_ids:
            return {}
        statement = (
            select(Meter.external_id, func.count(Subscription.customer_id.distinct()))
            .join(
                ProductPrice,
                # The subclass attribute would add a polymorphic filter and drop tiered prices.
                ProductPrice.__table__.c.meter_id == Meter.id,
            )
            .join(
                SubscriptionProductPrice,
                SubscriptionProductPrice.product_price_id == ProductPrice.id,
            )
            .join(
                Subscription,
                Subscription.id == SubscriptionProductPrice.subscription_id,
            )
            .where(
                Meter.organization_id == organization_id,
                Meter.external_id.in_(external_ids),
                ProductPrice.is_metered,
                Subscription.status.in_(SubscriptionStatus.billable_statuses()),
                ~Subscription.is_deleted,
                ~SubscriptionProductPrice.is_deleted,
            )
            .group_by(Meter.external_id)
        )
        result = await self.session.execute(statement)
        return {
            external_id: count
            for external_id, count in result.tuples()
            if external_id is not None
        }

    async def has_billable_subscriptions(self, meter_id: UUID) -> bool:
        statement = select(
            exists()
            .where(
                SubscriptionProductPrice.subscription_id == Subscription.id,
                ProductPrice.id == SubscriptionProductPrice.product_price_id,
            )
            .where(
                ProductPrice.is_metered,
                # The subclass attribute would add a polymorphic filter and drop tiered prices.
                ProductPrice.__table__.c.meter_id == meter_id,
                Subscription.status.in_(SubscriptionStatus.billable_statuses()),
                ~Subscription.is_deleted,
                ~SubscriptionProductPrice.is_deleted,
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one()
