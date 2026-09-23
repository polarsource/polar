import builtins
import json
from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import selectinload, with_polymorphic

from polar.kit.repository import RepositoryBase
from polar.models import (
    Customer,
    ProductPrice,
    VoidBillingIdentity,
)
from polar.models import (
    Event as EventModel,
)
from polar.models import (
    Meter as MeterModel,
)
from polar.models import (
    Product as ProductModel,
)
from polar.models import (
    Subscription as SubscriptionModel,
)
from polar.void.event.schemas import Event, event_payload

PRICES = with_polymorphic(ProductPrice, "*")


class SubscriptionRepository(RepositoryBase[SubscriptionModel]):
    model = SubscriptionModel

    def scoped_statement(
        self, organization_id: UUID
    ) -> Select[tuple[SubscriptionModel]]:
        return (
            select(SubscriptionModel)
            .where(
                SubscriptionModel.organization_id == organization_id,
                SubscriptionModel.deleted_at.is_(None),
                SubscriptionModel.billing_identity_id.is_not(None),
            )
            .options(
                selectinload(SubscriptionModel.billing_identity),
                selectinload(SubscriptionModel.product)
                .selectinload(ProductModel.prices.of_type(PRICES))
                .selectinload(PRICES.ProductPriceMeteredUnit.meter)
                .selectinload(MeterModel.deployment),
                selectinload(SubscriptionModel.customer),
                selectinload(SubscriptionModel.grants),
            )
            .execution_options(populate_existing=True)
        )

    async def customer_for_identity(
        self, identity: VoidBillingIdentity
    ) -> Customer | None:
        return await self.session.scalar(
            select(Customer).where(
                Customer.organization_id == identity.organization_id,
                Customer.deleted_at.is_(None),
                (Customer.root_identity_id == identity.id)
                | (Customer.external_id == identity.external_id),
            )
        )

    async def list(
        self,
        organization_id: UUID,
        *,
        identity_ids: Sequence[UUID] | None = None,
        active_at: datetime | None = None,
    ) -> Sequence[SubscriptionModel]:
        statement = self.scoped_statement(organization_id)
        if identity_ids is not None:
            statement = statement.where(
                SubscriptionModel.billing_identity_id.in_(identity_ids)
            )
        if active_at is not None:
            statement = statement.where(
                SubscriptionModel.started_at <= active_at,
                SubscriptionModel.ends_at.is_(None)
                | (SubscriptionModel.ends_at > active_at),
            )
        return await self.get_all(
            statement.order_by(SubscriptionModel.created_at, SubscriptionModel.id)
        )

    async def get(self, organization_id: UUID, id: UUID) -> SubscriptionModel | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(SubscriptionModel.id == id)
        )

    async def lifecycle_events(
        self, organization_id: UUID, names: Sequence[str]
    ) -> builtins.list[Event]:
        rows = (
            await self.session.scalars(
                select(EventModel)
                .where(
                    EventModel.organization_id == organization_id,
                    EventModel.source == "system",
                    EventModel.name.in_(names),
                )
                .order_by(EventModel.timestamp, EventModel.ingested_at, EventModel.id)
            )
        ).all()
        return [
            Event.model_validate(
                {
                    **event_payload(row),
                    "metadata": json.loads(event_payload(row)["metadata"]),
                }
            )
            for row in rows
        ]
