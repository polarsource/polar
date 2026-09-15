from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, String, Uuid, column, or_, select, true, values
from sqlalchemy.orm import contains_eager

from polar.kit.repository import RepositoryBase
from polar.models import (
    Customer,
    VoidBillingIdentity,
    VoidReducer,
    VoidReducerBucket,
    VoidSubscription,
)


class CustomerRepository(RepositoryBase[Customer]):
    model = Customer

    def get_active_statement(self, organization_id: UUID) -> Select[tuple[Customer]]:
        return (
            self.get_base_statement()
            .join(Customer.root_identity)
            .where(
                Customer.organization_id == organization_id,
                Customer.deleted_at.is_(None),
                VoidBillingIdentity.deleted_at.is_(None),
                VoidBillingIdentity.parent_id.is_(None),
            )
            .options(contains_eager(Customer.root_identity))
        )

    async def list(self, organization_id: UUID) -> Sequence[Customer]:
        return await self.get_all(
            self.get_active_statement(organization_id).order_by(
                Customer.created_at, Customer.id
            )
        )

    async def get_active_by_external_id(
        self, organization_id: UUID, external_id: str
    ) -> Customer | None:
        return await self.get_one_or_none(
            self.get_active_statement(organization_id).where(
                VoidBillingIdentity.external_id == external_id
            )
        )

    async def get_by_identity_id(
        self, organization_id: UUID, identity_id: UUID
    ) -> Customer | None:
        return await self.get_one_or_none(
            self.get_base_statement().where(
                Customer.organization_id == organization_id,
                Customer.root_identity_id == identity_id,
            )
        )

    async def lock_customer(
        self, organization_id: UUID, customer_id: UUID
    ) -> Customer | None:
        statement = (
            select(Customer)
            .where(
                Customer.id == customer_id,
                Customer.organization_id == organization_id,
                Customer.deleted_at.is_(None),
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def get_active_by_identity_id(
        self, organization_id: UUID, identity_id: UUID
    ) -> Customer | None:
        return await self.get_one_or_none(
            self.get_active_statement(organization_id).where(
                Customer.root_identity_id == identity_id
            )
        )


class CustomerStateRepository(RepositoryBase[VoidReducerBucket]):
    model = VoidReducerBucket

    async def upcoming_subscription_changes(
        self, organization_id: UUID, identity_ids: Sequence[UUID], at: datetime
    ) -> Sequence[datetime]:
        rows = await self.session.execute(
            select(VoidSubscription.started_at, VoidSubscription.ends_at).where(
                VoidSubscription.organization_id == organization_id,
                VoidSubscription.deleted_at.is_(None),
                VoidSubscription.billing_identity_id.in_(identity_ids),
                or_(VoidSubscription.started_at > at, VoidSubscription.ends_at > at),
            )
        )
        return [
            date for dates in rows for date in dates if date is not None and date > at
        ]

    async def reducers(
        self, organization_id: UUID, reducer_ids: Sequence[UUID]
    ) -> Sequence[VoidReducer]:
        return (
            await self.session.scalars(
                select(VoidReducer)
                .where(
                    VoidReducer.organization_id == organization_id,
                    VoidReducer.id.in_(reducer_ids),
                    VoidReducer.deleted_at.is_(None),
                )
                .order_by(VoidReducer.slug)
            )
        ).all()

    async def last_processed_events(
        self,
        organization_id: UUID,
        reducer_ids: Sequence[UUID],
        identity_ids: Sequence[str],
    ) -> Sequence[tuple[UUID, str, str, str]]:
        if not reducer_ids or not identity_ids:
            return []
        pairs = (
            values(column("reducer_id", Uuid), column("actor", String))
            .data(
                [
                    (reducer_id, actor)
                    for reducer_id in reducer_ids
                    for actor in identity_ids
                ]
            )
            .alias("pairs")
        )
        last = (
            select(
                VoidReducerBucket.last_processed_event["external_id"].astext.label(
                    "external_id"
                ),
                VoidReducerBucket.last_processed_event["timestamp"].astext.label(
                    "timestamp"
                ),
                VoidReducerBucket.last_processed_event["ingested_at"].astext.label(
                    "ingested_at"
                ),
            )
            .where(
                VoidReducerBucket.organization_id == organization_id,
                VoidReducerBucket.deleted_at.is_(None),
                VoidReducerBucket.reducer_id == pairs.c.reducer_id,
                VoidReducerBucket.external_identity_id == pairs.c.actor,
                VoidReducerBucket.last_processed_event.is_not(None),
            )
            .order_by(
                VoidReducerBucket.last_processed_event["ingested_at"].astext.desc(),
                VoidReducerBucket.last_processed_event["timestamp"].astext.desc(),
                VoidReducerBucket.last_processed_event["external_id"].astext.desc(),
            )
            .limit(1)
            .lateral("last")
        )
        rows = await self.session.execute(
            select(pairs.c.reducer_id, last).select_from(pairs.join(last, true()))
        )
        return rows.tuples().all()

    async def buckets_since(
        self,
        organization_id: UUID,
        reducer_ids: Sequence[UUID],
        identity_ids: Sequence[str],
        start: datetime,
        end: datetime,
    ) -> Sequence[VoidReducerBucket]:
        return await self.get_all(
            select(VoidReducerBucket)
            .where(
                VoidReducerBucket.organization_id == organization_id,
                VoidReducerBucket.deleted_at.is_(None),
                VoidReducerBucket.reducer_id.in_(reducer_ids),
                VoidReducerBucket.external_identity_id.in_(identity_ids),
                VoidReducerBucket.bucket_start >= start,
                VoidReducerBucket.bucket_start < end,
            )
            .order_by(
                VoidReducerBucket.reducer_id,
                VoidReducerBucket.external_identity_id,
                VoidReducerBucket.bucket_start,
            )
        )
