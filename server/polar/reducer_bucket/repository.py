from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Row, and_, func, literal, null, or_, select
from sqlalchemy.dialects.postgresql import insert

from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.repository import RepositoryBase
from polar.meter.aggregation import PropertyAggregation
from polar.models import Event, Reducer, ReducerBucket
from polar.models.event import EventSource

from .redis_store import get_reducer_bucket_key


def _is_customer(
    model: type[Event | ReducerBucket],
    customer_id: UUID | None,
    external_customer_id: str | None,
) -> ColumnElement[bool]:
    return and_(
        model.customer_id.is_not_distinct_from(customer_id),
        model.external_customer_id.is_not_distinct_from(external_customer_id),
    )


class ReducerBucketRepository(RepositoryBase[ReducerBucket]):
    model = ReducerBucket

    async def lock_buckets(
        self,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> None:
        """Locks the reducer's buckets of the customer identity starting at
        `bucket_start` exclusively until the transaction ends."""
        await pg_advisory_xact_lock(
            self.session,
            "reducer_bucket.buckets",
            get_reducer_bucket_key(
                reducer.id, bucket_start, customer_id, external_customer_id
            ),
        )

    async def aggregate_events(
        self,
        reducer: Reducer,
        bucket_start: datetime,
        bucket_end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> Row[Any]:
        """count, sum, min and max of the customer identity's user events for the
        reducer in the range, ingested after its latest sealed bucket."""
        sealed_at = (
            select(func.max(ReducerBucket.sealed_at))
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                ReducerBucket.bucket_start == bucket_start,
                _is_customer(ReducerBucket, customer_id, external_customer_id),
            )
            .scalar_subquery()
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
        statement = select(
            func.count().label("count"),
            statistics[0].label("sum"),
            statistics[1].label("min"),
            statistics[2].label("max"),
        ).where(
            Event.organization_id == reducer.organization_id,
            Event.source == EventSource.user,
            Event.timestamp >= bucket_start,
            Event.timestamp < bucket_end,
            _is_customer(Event, customer_id, external_customer_id),
            reducer.filter.get_sql_clause(Event),
            aggregation.get_sql_clause(Event),
            or_(sealed_at.is_(None), Event.ingested_at > sealed_at),
        )
        result = await self.session.execute(statement)
        return result.one()

    async def get_latest(
        self,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> ReducerBucket | None:
        """The customer identity's bucket of the highest generation."""
        statement = (
            self.get_base_statement()
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                ReducerBucket.bucket_start == bucket_start,
                _is_customer(ReducerBucket, customer_id, external_customer_id),
            )
            .order_by(ReducerBucket.generation.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def insert_buckets(self, values: Sequence[dict[str, Any]]) -> None:
        if not values:
            return
        await self.session.execute(insert(ReducerBucket).values(values))
