from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import Row, and_, func, literal, null, or_, select
from sqlalchemy.dialects.postgresql import insert

from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.repository import RepositoryBase
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.models import Event, Reducer, ReducerBucket
from polar.reducer.repository import ReducerRepository

EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


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

    async def get_windows_to_sync(
        self,
        *,
        bucket_size: timedelta,
        ingested_since: datetime,
        before: datetime,
        write_margin: timedelta,
        recently_written_since: datetime,
    ) -> Sequence[Row[Any]]:
        """(organization_id, bucket_start) pairs before `before`, with events
        ingested since `ingested_since`, for organizations with active, non-unique
        reducers, whose buckets were never written or got events since.

        Buckets written since `recently_written_since` are also synced again for
        events ingested up to `write_margin` before the write, which it may have
        missed while their request was still committing.
        """
        syncable_organization_ids = (
            ReducerRepository.from_session(self.session)
            .get_active_statement()
            .where(
                func.jsonb_extract_path_text(Reducer.aggregation, "func")
                != AggregationFunction.unique
            )
            .with_only_columns(Reducer.organization_id)
        )
        bucket_start = func.date_bin(bucket_size, Event.timestamp, EPOCH)
        windows = (
            select(
                Event.organization_id,
                bucket_start.label("bucket_start"),
                func.max(Event.ingested_at).label("last_ingested_at"),
            )
            .where(
                Event.ingested_at >= ingested_since,
                Event.timestamp < before,
                Event.organization_id.in_(syncable_organization_ids),
            )
            .group_by(Event.organization_id, bucket_start)
            .subquery()
        )
        written_at = func.max(
            func.coalesce(ReducerBucket.modified_at, ReducerBucket.created_at)
        )
        statement = (
            select(windows.c.organization_id, windows.c.bucket_start)
            .outerjoin(
                ReducerBucket,
                and_(
                    ReducerBucket.organization_id == windows.c.organization_id,
                    ReducerBucket.bucket_start == windows.c.bucket_start,
                ),
            )
            .group_by(
                windows.c.organization_id,
                windows.c.bucket_start,
                windows.c.last_ingested_at,
            )
            .having(
                or_(
                    written_at.is_(None),
                    windows.c.last_ingested_at > written_at,
                    and_(
                        windows.c.last_ingested_at > written_at - write_margin,
                        written_at >= recently_written_since,
                    ),
                )
            )
        )
        result = await self.session.execute(statement)
        return result.all()

    async def aggregate_events(
        self, reducer: Reducer, bucket_start: datetime, bucket_end: datetime
    ) -> Sequence[Row[Any]]:
        """count, sum, min and max of the reducer's events in the range, per
        customer identity."""
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
            .where(
                Event.organization_id == reducer.organization_id,
                Event.timestamp >= bucket_start,
                Event.timestamp < bucket_end,
                reducer.filter.get_sql_clause(Event),
                aggregation.get_sql_clause(Event),
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
