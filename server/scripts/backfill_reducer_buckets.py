from bisect import bisect_right
from collections.abc import AsyncIterator, Collection, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import typer
from sqlalchemy import (
    ColumnElement,
    Row,
    and_,
    case,
    delete,
    event,
    func,
    literal,
    null,
    or_,
    select,
)

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.meter.aggregation import PropertyAggregation, UniqueAggregation
from polar.models import (
    BillingEntry,
    Customer,
    Event,
    MeterReducer,
    Order,
    OrderItem,
    ProductPrice,
    Reducer,
    ReducerBucket,
    Subscription,
)
from polar.models.billing_entry import BillingEntryType
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.postgres import create_async_engine
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import REDUCER_BUCKET_SIZE, get_reducer_bucket_start

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

PAGE_SIZE = 5000

type BucketValues = dict[str, Any]
type BucketKey = tuple[UUID, datetime, datetime, UUID | None, str | None]
"""reducer_id, bucket_start, bucket_end, customer_id, external_customer_id"""
type Boundaries = dict[tuple[UUID | str, UUID], list[datetime]]
"""Per customer id or external id and reducer, the sorted timestamps buckets
are split at: each subscription's billable start, so that usage before it can
never be billed. Past billing cutoffs aren't reconstructed: what each order
billed is a sealed generation, what's pending an open one."""


@dataclass
class Summary:
    count: int = 0
    sum: Decimal = Decimal(0)
    min: Decimal | None = None
    max: Decimal | None = None

    def add(self, value: Decimal) -> None:
        self.count += 1
        self.sum += value
        self.min = value if self.min is None else min(self.min, value)
        self.max = value if self.max is None else max(self.max, value)


type Billing = tuple[datetime, UUID]
"""created_at and id of the order that billed some usage"""
type Totals = dict[BucketKey, dict[Billing | None, Summary]]
"""Per bucket, the summary of its usage per order that billed it, with the
unbilled usage under None."""


async def backfill_organization(
    session: AsyncSession,
    organization_id: UUID,
    start: datetime,
    end: datetime,
    *,
    page_size: int = PAGE_SIZE,
) -> int:
    """Rebuilds the buckets of all the organization's reducers starting in
    [start, end) from one pass over its events, and returns how many were written."""
    reducers = await _get_reducers(session, organization_id)
    boundaries = await _get_boundaries(session, organization_id)
    totals: Totals = {}
    flushed_until = start
    written = 0
    seen = 0
    async for rows in _iter_events(
        session, organization_id, reducers, start, end, page_size
    ):
        billed_at = await _get_billed_at(session, _matched_event_ids(rows))
        _add_to_totals(totals, reducers, rows, billed_at, boundaries)
        # The page may end inside a bucket: only the buckets before it are complete.
        flush_until = get_reducer_bucket_start(rows[-1].timestamp)
        written += await _flush(
            session, organization_id, totals, flushed_until, flush_until, end
        )
        flushed_until = flush_until
        await session.commit()
        seen += len(rows)
        typer.echo(
            f"{utc_now():%H:%M:%S}  {seen:,} events, {written:,} buckets, "
            f"flushed until {flushed_until.isoformat()}"
        )
    written += await _flush(session, organization_id, totals, flushed_until, end, end)
    await session.commit()
    return written


async def _iter_events(
    session: AsyncSession,
    organization_id: UUID,
    reducers: Sequence[Reducer],
    start: datetime,
    end: datetime,
    page_size: int,
) -> AsyncIterator[Sequence[Row[Any]]]:
    """Pages of the organization's user events with a timestamp in [start, end),
    in (timestamp, id) order."""
    after: tuple[datetime, UUID] | None = None
    while True:
        rows = await _get_events_page(
            session, organization_id, reducers, start, end, after, page_size
        )
        if not rows:
            return
        yield rows
        after = (rows[-1].timestamp, rows[-1].id)


async def _flush(
    session: AsyncSession,
    organization_id: UUID,
    totals: Totals,
    start: datetime,
    end: datetime,
    synced_at: datetime,
) -> int:
    """Replaces the organization's buckets starting in [start, end) with the
    totals of those buckets, which it drops from `totals`."""
    completed = _pop_totals_before(totals, end)
    buckets = _to_buckets(organization_id, completed, synced_at)
    await _delete_buckets(session, organization_id, start, end)
    await _insert_buckets(session, buckets)
    return len(buckets)


async def _get_organization_ids(
    session: AsyncSession, organization_id: UUID | None, after: UUID | None
) -> Sequence[UUID]:
    """The organizations with active reducers, or the given one."""
    if organization_id is not None:
        return [organization_id]
    statement = (
        ReducerRepository.from_session(session)
        .get_active_statement((ReducerKind.usage,))
        .with_only_columns(Reducer.organization_id)
        .distinct()
        .order_by(Reducer.organization_id)
    )
    if after is not None:
        statement = statement.where(Reducer.organization_id > after)
    return (await session.scalars(statement)).all()


async def _get_reducers(
    session: AsyncSession, organization_id: UUID
) -> Sequence[Reducer]:
    """The organization's active reducers with a mergeable aggregation."""
    reducers = await ReducerRepository.from_session(
        session
    ).get_all_active_by_organization(organization_id, (ReducerKind.usage,))
    return [
        reducer
        for reducer in reducers
        if not isinstance(reducer.aggregation, UniqueAggregation)
    ]


async def _get_boundaries(session: AsyncSession, organization_id: UUID) -> Boundaries:
    """The timestamps the organization's buckets are split at, per customer and
    reducer, with the customer's external id as an alternate key."""
    billable_from = (
        select(
            Subscription.customer_id,
            Customer.external_id,
            MeterReducer.reducer_id,
            func.coalesce(Subscription.trial_end, Subscription.started_at),
        )
        .join(Customer, Customer.id == Subscription.customer_id)
        .join(ProductPrice, ProductPrice.product_id == Subscription.product_id)
        .join(MeterReducer, MeterReducer.meter_id == ProductPrice.__table__.c.meter_id)
        .where(
            Subscription.organization_id == organization_id,
            Subscription.started_at.is_not(None),
        )
    )
    boundaries: Boundaries = {}
    for statement in (billable_from,):
        for customer_id, external_id, reducer_id, at in await session.execute(
            statement
        ):
            boundaries.setdefault((customer_id, reducer_id), []).append(at)
            if external_id is not None:
                boundaries.setdefault((external_id, reducer_id), []).append(at)
    return {key: sorted(set(ats)) for key, ats in boundaries.items()}


def _get_interval(
    boundaries: list[datetime], bucket_start: datetime, timestamp: datetime
) -> tuple[datetime, datetime]:
    """The part of the bucket the timestamp falls in, once the bucket is split
    at the boundaries inside it."""
    bucket_end = bucket_start + REDUCER_BUCKET_SIZE
    index = bisect_right(boundaries, timestamp)
    start = max(boundaries[index - 1], bucket_start) if index > 0 else bucket_start
    end = min(boundaries[index], bucket_end) if index < len(boundaries) else bucket_end
    return start, end


async def _get_events_page(
    session: AsyncSession,
    organization_id: UUID,
    reducers: Sequence[Reducer],
    start: datetime,
    end: datetime,
    after: tuple[datetime, UUID] | None,
    page_size: int,
) -> Sequence[Row[Any]]:
    """Up to `page_size` of the organization's user events with a timestamp in
    [start, end) and (timestamp, id) after `after`, in that order: the event's
    id, timestamp and customer identity, then its value for each reducer."""
    statement = (
        select(
            Event.id,
            Event.timestamp,
            Event.customer_id,
            Event.external_customer_id,
            *(_value_column(reducer) for reducer in reducers),
        )
        .where(
            Event.organization_id == organization_id,
            Event.source == EventSource.user,
            Event.timestamp >= start,
            Event.timestamp < end,
        )
        # Walks ix_events_org_timestamp_id backwards: timestamp DESC, id ASC reversed.
        .order_by(Event.timestamp.asc(), Event.id.desc())
        .limit(page_size)
    )
    if after is not None:
        after_timestamp, after_id = after
        statement = statement.where(
            Event.timestamp >= after_timestamp,
            or_(Event.timestamp > after_timestamp, Event.id < after_id),
        )
    return (await session.execute(statement)).all()


def _value_column(reducer: Reducer) -> ColumnElement[Any]:
    """The event's contribution to the reducer, or NULL if it doesn't match:
    the same SQL the sync path aggregates with."""
    aggregation = reducer.aggregation
    value = (
        aggregation.get_sql_value(Event)
        if isinstance(aggregation, PropertyAggregation)
        else literal(1)
    )
    matches = and_(
        reducer.filter.get_sql_clause(Event), aggregation.get_sql_clause(Event)
    )
    return case((matches, value), else_=null())


async def _get_billed_at(
    session: AsyncSession, event_ids: Sequence[UUID]
) -> dict[tuple[UUID, UUID], Billing]:
    """Per event and reducer, the order that billed the event for one of the
    reducer's meters, from its metered billing entries linked to an order item."""
    if not event_ids:
        return {}
    statement = (
        select(
            BillingEntry.event_id, MeterReducer.reducer_id, Order.created_at, Order.id
        )
        .join(BillingEntry.order_item)
        .join(OrderItem.order)
        .join(ProductPrice, ProductPrice.id == BillingEntry.product_price_id)
        .join(MeterReducer, MeterReducer.meter_id == ProductPrice.__table__.c.meter_id)
        .where(
            BillingEntry.event_id.in_(event_ids),
            BillingEntry.type == BillingEntryType.metered,
            BillingEntry.deleted_at.is_(None),
        )
    )
    result = await session.execute(statement)
    return {
        (event_id, reducer_id): (created_at, order_id)
        for event_id, reducer_id, created_at, order_id in result.tuples()
    }


def _matched_event_ids(rows: Sequence[Row[Any]]) -> list[UUID]:
    """The events with a value for at least one reducer."""
    return [
        id
        for id, _, _, _, *values in rows
        if any(value is not None for value in values)
    ]


def _add_to_totals(
    totals: Totals,
    reducers: Sequence[Reducer],
    rows: Sequence[Row[Any]],
    billed_at: dict[tuple[UUID, UUID], Billing],
    boundaries: Boundaries,
) -> None:
    """Adds each event's value to the bucket of every reducer it matches, under
    the order that billed it for that reducer, or None."""
    for row in rows:
        id, timestamp, customer_id, external_customer_id, *values = row
        bucket_start = get_reducer_bucket_start(timestamp)
        customer_key = customer_id if customer_id is not None else external_customer_id
        for reducer, value in zip(reducers, values, strict=True):
            if value is None:
                continue
            start, end = _get_interval(
                boundaries.get((customer_key, reducer.id), []), bucket_start, timestamp
            )
            key = (reducer.id, start, end, customer_id, external_customer_id)
            billing = billed_at.get((id, reducer.id))
            totals.setdefault(key, {}).setdefault(billing, Summary()).add(
                Decimal(str(value))
            )


def _pop_totals_before(totals: Totals, end: datetime) -> Totals:
    """Removes and returns the totals of the buckets starting before `end`."""
    completed = [key for key in totals if key[1] < end]
    return {key: totals.pop(key) for key in completed}


def _to_buckets(
    organization_id: UUID, totals: Totals, synced_at: datetime
) -> list[BucketValues]:
    """Bucket rows to insert: each bucket gets one generation per billing order
    in order of billing, sealed and billed at the order's created_at, then the
    unbilled usage last, unsealed."""
    buckets: list[BucketValues] = []
    for (
        reducer_id,
        bucket_start,
        bucket_end,
        customer_id,
        external_customer_id,
    ), summaries in totals.items():
        for generation, billing in enumerate(_generation_order(summaries), 1):
            summary = summaries[billing]
            sealed_at, order_id = billing if billing is not None else (None, None)
            buckets.append(
                {
                    "organization_id": organization_id,
                    "reducer_id": reducer_id,
                    "customer_id": customer_id,
                    "external_customer_id": external_customer_id,
                    "bucket_start": bucket_start,
                    "bucket_end": bucket_end,
                    "generation": generation,
                    "sealed_at": sealed_at,
                    "billed_at": sealed_at,
                    "order_id": order_id,
                    "synced_at": synced_at,
                    "count": summary.count,
                    "sum": summary.sum,
                    "min": summary.min,
                    "max": summary.max,
                }
            )
    return buckets


def _generation_order(billings: Collection[Billing | None]) -> list[Billing | None]:
    billed = sorted(billing for billing in billings if billing is not None)
    return [*billed, None] if None in billings else [*billed]


async def _delete_buckets(
    session: AsyncSession, organization_id: UUID, start: datetime, end: datetime
) -> None:
    await session.execute(
        delete(ReducerBucket).where(
            ReducerBucket.organization_id == organization_id,
            ReducerBucket.bucket_start >= start,
            ReducerBucket.bucket_start < end,
        )
    )


BUCKET_COLUMNS = [
    "organization_id",
    "reducer_id",
    "customer_id",
    "external_customer_id",
    "bucket_start",
    "bucket_end",
    "generation",
    "sealed_at",
    "billed_at",
    "order_id",
    "synced_at",
    "count",
    "sum",
    "min",
    "max",
]


async def _insert_buckets(session: AsyncSession, buckets: list[BucketValues]) -> None:
    """COPY, straight through asyncpg: three times faster than INSERT here."""
    if not buckets:
        return
    created_at = utc_now()
    records = [
        (uuid4(), created_at, *(bucket[column] for column in BUCKET_COLUMNS))
        for bucket in buckets
    ]
    connection = (
        await (await session.connection()).get_raw_connection()
    ).driver_connection
    # COPY bypasses SQLAlchemy, which only begins the transaction on its first
    # statement: the flush's delete. Without it, COPY would autocommit.
    assert connection is not None
    assert connection.is_in_transaction()
    await connection.copy_records_to_table(
        ReducerBucket.__tablename__,
        records=records,
        columns=["id", "created_at", *BUCKET_COLUMNS],
    )


def _prefer_organization_index(connection: Any, _: Any) -> None:
    """Keeps the planner off the global timestamp index, which is slow where an
    organization's events are sparse."""
    connection.run_async(lambda raw: raw.execute("SET enable_incremental_sort = off"))


@cli.command()
@typer_async
async def backfill(
    start: datetime,
    end: datetime,
    organization_id: UUID | None = None,
    after_organization_id: UUID | None = None,
    page_size: int = typer.Option(PAGE_SIZE, min=1),
) -> None:
    """Rebuild usage and billing buckets, excluding the latest ten minutes."""
    # Whole buckets only: a window ending inside a bucket would rebuild it from
    # part of its events.
    start = get_reducer_bucket_start(start.replace(tzinfo=UTC))
    end = get_reducer_bucket_start(
        min(end.replace(tzinfo=UTC), utc_now() - timedelta(minutes=10))
    )
    configure_script_logging()
    engine = create_async_engine("script")
    event.listen(engine.sync_engine, "connect", _prefer_organization_index)
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            typer.echo(f"Backfilling [{start.isoformat()}, {end.isoformat()})")
            for id in await _get_organization_ids(
                session, organization_id, after_organization_id
            ):
                written = await backfill_organization(
                    session, id, start, end, page_size=page_size
                )
                typer.echo(f"Organization {id}: {written} buckets")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
