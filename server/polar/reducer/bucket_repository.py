from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    Row,
    Select,
    and_,
    func,
    literal,
    null,
    or_,
    select,
    true,
    update,
)
from sqlalchemy.dialects.postgresql import insert

from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.meter.aggregation import PropertyAggregation
from polar.models import Event, Reducer, ReducerBucket, StagedEvent
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind

from .redis_store import get_reducer_bucket_key


def _is_customer(
    model: type[Event | StagedEvent | ReducerBucket],
    customer_id: UUID | None,
    external_customer_id: str | None,
) -> ColumnElement[bool]:
    return and_(
        model.customer_id == customer_id,
        model.external_customer_id == external_customer_id,
    )


def _is_any_customer(
    identities: Sequence[tuple[UUID | None, str | None]],
) -> ColumnElement[bool]:
    return or_(
        *(
            _is_customer(ReducerBucket, customer_id, external_customer_id)
            for customer_id, external_customer_id in identities
        )
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
    ) -> Row[Any, Any, Any, Any]:
        """count, sum, min and max of the customer identity's events for the
        reducer in the range, ingested after its latest sealed bucket: system events
        for a credit reducer, user events otherwise."""
        # Events still waiting in `staged_events` count too: the mover takes each one
        # out of `staged_events` and into `events` in a single transaction, so this
        # one statement sees every event exactly once.
        events = self._aggregate_statement(
            Event, reducer, bucket_start, bucket_end, customer_id, external_customer_id
        ).subquery("events_statistics")
        staged_events = self._aggregate_statement(
            StagedEvent,
            reducer,
            bucket_start,
            bucket_end,
            customer_id,
            external_customer_id,
        ).subquery("staged_events_statistics")
        statement = select(
            (events.c.count + staged_events.c.count).label("count"),
            (events.c.sum + staged_events.c.sum).label("sum"),
            func.least(events.c.min, staged_events.c.min).label("min"),
            func.greatest(events.c.max, staged_events.c.max).label("max"),
        ).select_from(events.join(staged_events, true()))
        result = await self.session.execute(statement)
        return result.one()

    def _aggregate_statement(
        self,
        model: type[Event | StagedEvent],
        reducer: Reducer,
        bucket_start: datetime,
        bucket_end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> Select[*tuple[Any, ...]]:
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
            value = aggregation.get_sql_value(model)
            statistics = (
                func.coalesce(func.sum(value), 0),
                func.min(value),
                func.max(value),
            )
        else:
            statistics = (literal(0), null(), null())
        return select(
            func.count().label("count"),
            statistics[0].label("sum"),
            statistics[1].label("min"),
            statistics[2].label("max"),
        ).where(
            model.organization_id == reducer.organization_id,
            model.source
            == (
                EventSource.system
                if reducer.kind == ReducerKind.credit
                else EventSource.user
            ),
            model.timestamp >= bucket_start,
            model.timestamp < bucket_end,
            _is_customer(model, customer_id, external_customer_id),
            reducer.filter.get_sql_clause(model),
            aggregation.get_sql_clause(model),
            or_(sealed_at.is_(None), model.ingested_at > sealed_at),
        )

    async def get_all_starting_within(
        self,
        reducer: Reducer,
        start: datetime,
        end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> Sequence[ReducerBucket]:
        statement = self.get_base_statement().where(
            ReducerBucket.organization_id == reducer.organization_id,
            ReducerBucket.reducer_id == reducer.id,
            ReducerBucket.bucket_start >= start,
            ReducerBucket.bucket_start < end,
            _is_customer(ReducerBucket, customer_id, external_customer_id),
        )
        return await self.get_all(statement)

    async def get_latest_for_update(
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
            .with_for_update()
        )
        return await self.get_one_or_none(statement)

    async def get_unsealed_totals(
        self,
        organization_id: UUID,
        reducer_id: UUID,
        identities: Sequence[tuple[UUID | None, str | None]],
        *,
        before: datetime | None = None,
    ) -> Row[Any, Any, Any, Any]:
        """count, sum, min and max of the identities' unsealed buckets, starting
        before `before` if given."""
        return await self._get_totals(
            organization_id,
            reducer_id,
            identities,
            ReducerBucket.sealed_at.is_(None),
            ReducerBucket.bucket_start < before if before is not None else true(),
        )

    async def get_totals_starting_within(
        self,
        organization_id: UUID,
        reducer_id: UUID,
        identities: Sequence[tuple[UUID | None, str | None]],
        start: datetime | None,
        end: datetime,
    ) -> Row[Any, Any, Any, Any]:
        """count, sum, min and max of the identities' buckets of every generation
        starting in [start, end)."""
        clauses = [ReducerBucket.bucket_start < end]
        if start is not None:
            clauses.append(ReducerBucket.bucket_start >= start)
        return await self._get_totals(organization_id, reducer_id, identities, *clauses)

    async def _get_totals(
        self,
        organization_id: UUID,
        reducer_id: UUID,
        identities: Sequence[tuple[UUID | None, str | None]],
        *clauses: ColumnElement[bool],
    ) -> Row[Any, Any, Any, Any]:
        statement = select(
            func.coalesce(func.sum(ReducerBucket.count), 0).label("count"),
            func.coalesce(func.sum(ReducerBucket.sum), 0).label("sum"),
            func.min(ReducerBucket.min).label("min"),
            func.max(ReducerBucket.max).label("max"),
        ).where(
            ReducerBucket.organization_id == organization_id,
            ReducerBucket.reducer_id == reducer_id,
            _is_any_customer(identities),
            *clauses,
        )
        result = await self.session.execute(statement)
        return result.one()

    async def get_last_synced_end(
        self,
        organization_id: UUID,
        reducer_id: UUID,
        customer_id: UUID | None,
        external_customer_id: str | None,
        *,
        since: datetime,
    ) -> datetime | None:
        """End of the customer identity's latest bucket recomputed by sync, among
        those starting from `since`."""
        statement = select(func.max(ReducerBucket.bucket_end)).where(
            ReducerBucket.organization_id == organization_id,
            ReducerBucket.reducer_id == reducer_id,
            _is_customer(ReducerBucket, customer_id, external_customer_id),
            ReducerBucket.bucket_start >= since,
            ReducerBucket.synced_at.is_not(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def get_synced_end_within(
        self,
        organization_id: UUID,
        reducer_id: UUID,
        customer_id: UUID | None,
        external_customer_id: str | None,
        bucket_start: datetime,
        bucket_end: datetime,
    ) -> datetime | None:
        """End of the customer identity's latest bucket recomputed by sync, among
        those starting within the slot."""
        statement = select(func.max(ReducerBucket.bucket_end)).where(
            ReducerBucket.organization_id == organization_id,
            ReducerBucket.reducer_id == reducer_id,
            _is_customer(ReducerBucket, customer_id, external_customer_id),
            ReducerBucket.bucket_start >= bucket_start,
            ReducerBucket.bucket_start < bucket_end,
            ReducerBucket.synced_at.is_not(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def get_database_now(self) -> datetime:
        """The start of the current transaction, on the database clock."""
        result = await self.session.execute(select(func.now()))
        return result.scalar_one()

    async def add_contribution(
        self,
        reducer: Reducer,
        bucket_start: datetime,
        bucket_end: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
        *,
        count: int,
        total: Decimal = Decimal(0),
        minimum: Decimal | None = None,
        maximum: Decimal | None = None,
    ) -> None:
        """Adds to the customer identity's latest bucket, or to the next generation
        once it's sealed."""
        latest = await self.get_latest_for_update(
            reducer, bucket_start, customer_id, external_customer_id
        )
        if latest is not None and latest.sealed_at is None:
            await self.session.execute(
                update(ReducerBucket)
                .where(ReducerBucket.id == latest.id)
                .values(
                    count=ReducerBucket.count + count,
                    sum=ReducerBucket.sum + total,
                    min=func.least(ReducerBucket.min, minimum),
                    max=func.greatest(ReducerBucket.max, maximum),
                    modified_at=utc_now(),
                )
                .execution_options(synchronize_session=False)
            )
            return
        await self.session.execute(
            insert(ReducerBucket).values(
                organization_id=reducer.organization_id,
                reducer_id=reducer.id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                bucket_start=bucket_start,
                bucket_end=bucket_end,
                count=count,
                sum=total,
                min=minimum,
                max=maximum,
                generation=1 if latest is None else latest.generation + 1,
            )
        )

    async def mark_as_sealed(
        self,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        *,
        until: datetime,
        since: datetime | None = None,
        sealed_at: datetime,
    ) -> int:
        """Seals the identities' unsealed buckets ending by `until`, after `since`
        if given, and returns how many."""
        clauses = [ReducerBucket.bucket_end <= until]
        if since is not None:
            clauses.append(ReducerBucket.bucket_end > since)
        open_ids = (
            select(ReducerBucket.id)
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                _is_any_customer(identities),
                ReducerBucket.sealed_at.is_(None),
                *clauses,
            )
            .order_by(ReducerBucket.bucket_start)
            .with_for_update()
        )
        result = await self.session.execute(
            update(ReducerBucket)
            .where(ReducerBucket.id.in_(open_ids))
            .values(sealed_at=sealed_at, modified_at=sealed_at)
            .returning(ReducerBucket.id)
        )
        return len(result.all())

    async def mark_as_billed(
        self,
        reducer: Reducer,
        identities: Sequence[tuple[UUID | None, str | None]],
        order_id: UUID,
        *,
        since: datetime,
        until: datetime,
        billed_at: datetime,
    ) -> Sequence[tuple[int, Decimal, Decimal | None, Decimal | None]]:
        """Marks the identities' sealed, unbilled buckets within [since, until] as
        billed by the order, and returns their count, sum, min and max."""
        unbilled_ids = (
            select(ReducerBucket.id)
            .where(
                ReducerBucket.organization_id == reducer.organization_id,
                ReducerBucket.reducer_id == reducer.id,
                _is_any_customer(identities),
                ReducerBucket.sealed_at.is_not(None),
                ReducerBucket.billed_at.is_(None),
                ReducerBucket.bucket_start >= since,
                ReducerBucket.bucket_end <= until,
            )
            .order_by(ReducerBucket.bucket_start)
            .with_for_update()
        )
        result = await self.session.execute(
            update(ReducerBucket)
            .where(ReducerBucket.id.in_(unbilled_ids))
            .values(billed_at=billed_at, order_id=order_id, modified_at=billed_at)
            .returning(
                ReducerBucket.count,
                ReducerBucket.sum,
                ReducerBucket.min,
                ReducerBucket.max,
            )
        )
        return result.tuples().all()
