import builtins
import json
from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import selectinload

from polar.kit.repository import RepositoryBase
from polar.models import (
    VoidEntitlement,
    VoidEvent,
    VoidMeter,
    VoidProduct,
    VoidSubscription,
)
from polar.void.event.schemas import Event


class SubscriptionRepository(RepositoryBase[VoidSubscription]):
    model = VoidSubscription

    def scoped_statement(
        self, organization_id: UUID
    ) -> Select[tuple[VoidSubscription]]:
        return (
            select(VoidSubscription)
            .where(
                VoidSubscription.organization_id == organization_id,
                VoidSubscription.deleted_at.is_(None),
            )
            .options(
                selectinload(VoidSubscription.billing_identity),
                selectinload(VoidSubscription.product).selectinload(
                    VoidProduct.meters.and_(VoidMeter.deleted_at.is_(None))
                ),
                selectinload(VoidSubscription.product).selectinload(
                    VoidProduct.entitlements.and_(VoidEntitlement.deleted_at.is_(None))
                ),
            )
            .execution_options(populate_existing=True)
        )

    async def list(
        self,
        organization_id: UUID,
        *,
        identity_ids: Sequence[UUID] | None = None,
        active_at: datetime | None = None,
    ) -> Sequence[VoidSubscription]:
        statement = self.scoped_statement(organization_id)
        if identity_ids is not None:
            statement = statement.where(
                VoidSubscription.billing_identity_id.in_(identity_ids)
            )
        if active_at is not None:
            statement = statement.where(
                VoidSubscription.started_at <= active_at,
                VoidSubscription.ends_at.is_(None)
                | (VoidSubscription.ends_at > active_at),
            )
        return await self.get_all(
            statement.order_by(VoidSubscription.created_at, VoidSubscription.id)
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidSubscription | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidSubscription.id == id)
        )

    async def lifecycle_events(
        self, organization_id: UUID, names: Sequence[str]
    ) -> builtins.list[Event]:
        rows = (
            await self.session.scalars(
                select(VoidEvent)
                .where(
                    VoidEvent.organization_id == organization_id,
                    VoidEvent.payload["source"].astext == "system",
                    VoidEvent.payload["name"].astext.in_(names),
                )
                .order_by(VoidEvent.timestamp, VoidEvent.created_at, VoidEvent.id)
            )
        ).all()
        return [
            Event.model_validate(
                {**row.payload, "metadata": json.loads(row.payload["metadata"])}
            )
            for row in rows
        ]
