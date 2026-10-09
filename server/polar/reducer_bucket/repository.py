from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Row, and_, func, literal, null, or_, select
from sqlalchemy.dialects.postgresql import insert

from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.repository import RepositoryBase
from polar.meter.aggregation import PropertyAggregation
from polar.models import Event, Reducer, ReducerBucket
from polar.models.event import EventSource


class ReducerBucketRepository(RepositoryBase[ReducerBucket]):
    model = ReducerBucket

    async def lock_window(self, organization_id: UUID, bucket_start: datetime) -> None:
        """Locks the organization's buckets starting at `bucket_start` exclusively
        until the transaction ends."""
        await pg_advisory_xact_lock(
            self.session,
            "reducer_bucket.window",
            f"{organization_id}:{int(bucket_start.timestamp())}",
        )

    async def aggregate_events(
        self, reducer: Reducer, bucket_start: datetime, bucket_end: datetime
    ) -> Sequence[Row[Any]]:
        """count, sum, min and max of the reducer's user events in the range, per
        customer identity, ingested after its latest sealed bucket."""
        sealed = (
            select(
                ReducerBucket.customer_id,
                ReducerBucket.external_customer_id,
                func.max(ReducerBucket.sealed_at).label("sealed_at"),
            )
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                ReducerBucket.bucket_start == bucket_start,
                ReducerBucket.sealed_at.is_not(None),
            )
            .group_by(ReducerBucket.customer_id, ReducerBucket.external_customer_id)
            .subquery()
        )
        aggregation = reducer.aggregation
        statistics: tuple[Any, Any, Any]
        if isinstance(aggregation, PropertyAggregation):
            value = aggregation.get_sql_value(Event)
            statistics = (
                func.coalesce(func.sum(value), 0),
                func.min(value),
                func.max(value),
            )
        else:
            statistics = (literal(0), null(), null())
        statement = (
            select(
                Event.customer_id,
                Event.external_customer_id,
                func.count().label("count"),
                statistics[0].label("sum"),
                statistics[1].label("min"),
                statistics[2].label("max"),
            )
            .outerjoin(
                sealed,
                and_(
                    sealed.c.customer_id.is_not_distinct_from(Event.customer_id),
                    sealed.c.external_customer_id.is_not_distinct_from(
                        Event.external_customer_id
                    ),
                ),
            )
            .where(
                Event.organization_id == reducer.organization_id,
                Event.source == EventSource.user,
                Event.timestamp >= bucket_start,
                Event.timestamp < bucket_end,
                reducer.filter.get_sql_clause(Event),
                aggregation.get_sql_clause(Event),
                or_(
                    sealed.c.sealed_at.is_(None),
                    Event.ingested_at > sealed.c.sealed_at,
                ),
            )
            .group_by(Event.customer_id, Event.external_customer_id)
        )
        result = await self.session.execute(statement)
        return result.all()

    async def get_latest_by_reducer_and_bucket(
        self, reducer: Reducer, bucket_start: datetime
    ) -> Sequence[ReducerBucket]:
        """The highest generation of each customer identity's bucket."""
        statement = (
            self.get_base_statement()
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                ReducerBucket.bucket_start == bucket_start,
            )
            .distinct(ReducerBucket.customer_id, ReducerBucket.external_customer_id)
            .order_by(
                ReducerBucket.customer_id,
                ReducerBucket.external_customer_id,
                ReducerBucket.generation.desc(),
            )
        )
        return await self.get_all(statement)

    async def insert_buckets(self, values: Sequence[dict[str, Any]]) -> None:
        if not values:
            return
        await self.session.execute(insert(ReducerBucket).values(values))
