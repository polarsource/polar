from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from itertools import pairwise
from typing import Any
from uuid import UUID

import typer
from sqlalchemy import (
    TIMESTAMP,
    ColumnElement,
    CursorResult,
    Insert,
    Numeric,
    ScalarSelect,
    Subquery,
    and_,
    cast,
    delete,
    func,
    insert,
    literal,
    or_,
    select,
    text,
)

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.metadata import get_nested_metadata_attr
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
)
from polar.models.billing_entry import BillingEntryType
from polar.models.event import EventSource
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()
BUCKET_SIZE = timedelta(minutes=5)
WINDOW_SETTINGS = (
    "SET LOCAL work_mem = '256MB'",
    "SET LOCAL enable_sort = off",
    "SET LOCAL enable_nestloop = off",
    "SET LOCAL jit = off",
)


def floor_bucket(value: datetime) -> datetime:
    return value.replace(minute=value.minute // 5 * 5, second=0, microsecond=0)


def bucket_range(start: datetime, end: datetime) -> tuple[datetime, datetime]:
    start = start.replace(tzinfo=UTC) if start.tzinfo is None else start.astimezone(UTC)
    end = end.replace(tzinfo=UTC) if end.tzinfo is None else end.astimezone(UTC)
    if start >= end:
        raise typer.BadParameter("start must be before end")
    rounded_end = floor_bucket(end)
    if rounded_end < end:
        rounded_end += BUCKET_SIZE
    return floor_bucket(start), min(
        rounded_end, floor_bucket(utc_now() - timedelta(minutes=10))
    )


async def get_reducers(
    session: AsyncSession, *, organization_id: UUID | None, meter_id: UUID | None
) -> Sequence[Reducer]:
    statement = select(Reducer).where(Reducer.deleted_at.is_(None))
    if organization_id is not None:
        statement = statement.where(Reducer.organization_id == organization_id)
    if meter_id is not None:
        statement = statement.join(MeterReducer).where(
            MeterReducer.meter_id == meter_id
        )
    return (await session.scalars(statement)).all()


type Identity = tuple[UUID | None, str | None]
type Interval = tuple[datetime, datetime]


@dataclass(frozen=True)
class DeletedBucket:
    identity: Identity
    interval: Interval
    generation: int
    sealed_at: datetime | None


def select_external_customer_id(
    reducer: Reducer, customer_id: UUID
) -> ScalarSelect[str | None]:
    return (
        select(Customer.external_id)
        .where(
            Customer.id == customer_id,
            Customer.organization_id == reducer.organization_id,
        )
        .scalar_subquery()
    )


def is_in_customer_scope(
    model: type[Event | ReducerBucket], reducer: Reducer, customer_id: UUID
) -> ColumnElement[bool]:
    return or_(
        model.customer_id == customer_id,
        model.external_customer_id == select_external_customer_id(reducer, customer_id),
    )


def is_identity(
    model: type[Event | ReducerBucket], identity: Identity
) -> ColumnElement[bool]:
    customer_id, external_customer_id = identity
    return and_(
        model.customer_id.is_not_distinct_from(customer_id),
        model.external_customer_id.is_not_distinct_from(external_customer_id),
    )


async def delete_bucket_rows(
    session: AsyncSession,
    reducer: Reducer,
    start: datetime,
    end: datetime,
    *,
    customer_id: UUID | None = None,
) -> list[DeletedBucket]:
    """Deletes the rows starting in [start, end) and returns them."""
    statement = delete(ReducerBucket).where(
        ReducerBucket.organization_id == reducer.organization_id,
        ReducerBucket.reducer_id == reducer.id,
        ReducerBucket.bucket_start >= start,
        ReducerBucket.bucket_start < end,
    )
    if customer_id is not None:
        statement = statement.where(
            is_in_customer_scope(ReducerBucket, reducer, customer_id)
        )
    result = await session.execute(
        statement.returning(
            ReducerBucket.customer_id,
            ReducerBucket.external_customer_id,
            ReducerBucket.bucket_start,
            ReducerBucket.bucket_end,
            ReducerBucket.generation,
            ReducerBucket.sealed_at,
        )
    )
    return [
        DeletedBucket(
            identity=(row.customer_id, row.external_customer_id),
            interval=(row.bucket_start, row.bucket_end),
            generation=row.generation,
            sealed_at=row.sealed_at,
        )
        for row in result
    ]


def get_split_intervals(
    start: datetime, end: datetime, deleted: Sequence[DeletedBucket]
) -> dict[Identity, list[Interval]]:
    """The intervals sealing split [start, end) into, for each identity whose rows
    were split."""
    boundaries: dict[Identity, set[datetime]] = defaultdict(lambda: {start, end})
    for bucket in deleted:
        bucket_start, bucket_end = bucket.interval
        boundaries[bucket.identity].update((bucket_start, min(bucket_end, end)))
    return {
        identity: list(pairwise(sorted(points)))
        for identity, points in boundaries.items()
        if len(points) > 2
    }


def get_latest_sealed_at(
    deleted: Sequence[DeletedBucket], identity: Identity, interval_start: datetime
) -> datetime | None:
    """The `sealed_at` of the latest generation deleted for the interval."""
    generations = [
        bucket
        for bucket in deleted
        if bucket.identity == identity and bucket.interval[0] == interval_start
    ]
    if not generations:
        return None
    return max(generations, key=lambda bucket: bucket.generation).sealed_at


def select_event_value(reducer: Reducer) -> ColumnElement[Decimal | None]:
    if not isinstance(reducer.aggregation, PropertyAggregation):
        return literal(None, type_=Numeric)
    prop = reducer.aggregation.property
    if prop in Event._filterable_fields:
        _, attr = Event._filterable_fields[prop]
        return cast(attr, Numeric)
    return cast(get_nested_metadata_attr(Event, prop).astext, Numeric)


def select_billing_entries(reducer: Reducer) -> Subquery:
    """Which events got billed, and on what order."""
    return (
        select(
            BillingEntry.event_id,
            Order.id.label("order_id"),
            Order.created_at.label("sealed_at"),
        )
        .join(ProductPrice, ProductPrice.id == BillingEntry.product_price_id)
        .join(MeterReducer, MeterReducer.meter_id == ProductPrice.__table__.c.meter_id)
        .outerjoin(OrderItem, OrderItem.id == BillingEntry.order_item_id)
        .outerjoin(Order, Order.id == OrderItem.order_id)
        .where(
            MeterReducer.reducer_id == reducer.id,
            BillingEntry.type == BillingEntryType.metered,
            BillingEntry.deleted_at.is_(None),
        )
        .subquery()
    )


def build_bucket_insert(
    reducer: Reducer,
    start: datetime,
    end: datetime,
    *event_clauses: ColumnElement[bool],
) -> Insert:
    """Inserts a bucket per 5-minute bucket, customer identity and order for the
    events matching `event_clauses`, clipped to [start, end) and numbering
    generations by billing order."""
    value = select_event_value(reducer)
    billing_entries = select_billing_entries(reducer)
    is_billed = billing_entries.c.event_id.is_not(None)
    start_literal = literal(start, TIMESTAMP(timezone=True))
    bin_start = func.date_bin(
        BUCKET_SIZE, Event.timestamp, start_literal, type_=TIMESTAMP(timezone=True)
    )
    bucket_start = func.greatest(bin_start, start_literal)
    bucket_end = func.least(
        bin_start + BUCKET_SIZE, literal(end, TIMESTAMP(timezone=True))
    )

    # Aggregate events per customer and order (non-associated orders are aggregated together)
    generations = (
        select(
            Event.customer_id,
            Event.external_customer_id,
            bucket_start.label("bucket_start"),
            bucket_end.label("bucket_end"),
            billing_entries.c.order_id,
            billing_entries.c.sealed_at,
            func.count().label("count"),
            func.coalesce(func.sum(value), 0).label("sum"),
            func.min(value).label("min"),
            func.max(value).label("max"),
        )
        .select_from(Event)
        .outerjoin(billing_entries, billing_entries.c.event_id == Event.id)
        .where(
            Event.organization_id == reducer.organization_id,
            Event.source == EventSource.user,
            Event.timestamp >= start,
            Event.timestamp < end,
            reducer.aggregation.get_sql_clause(Event),
            or_(is_billed, reducer.filter.get_sql_clause(Event)),
            *event_clauses,
        )
        .group_by(
            Event.customer_id,
            Event.external_customer_id,
            bucket_start,
            bucket_end,
            billing_entries.c.order_id,
            billing_entries.c.sealed_at,
        )
        .cte("generations")
    )

    # Insert the aggregated buckets and set generation to row_number()
    return insert(ReducerBucket).from_select(
        [
            "id",
            "organization_id",
            "reducer_id",
            "customer_id",
            "external_customer_id",
            "bucket_start",
            "bucket_end",
            "count",
            "sum",
            "min",
            "max",
            "generation",
            "sealed_at",
        ],
        select(
            func.gen_random_uuid(),
            literal(reducer.organization_id),
            literal(reducer.id),
            generations.c.customer_id,
            generations.c.external_customer_id,
            generations.c.bucket_start,
            generations.c.bucket_end,
            generations.c.count,
            generations.c.sum,
            generations.c.min,
            generations.c.max,
            func.row_number().over(
                partition_by=(
                    generations.c.customer_id,
                    generations.c.external_customer_id,
                    generations.c.bucket_start,
                ),
                order_by=(
                    generations.c.sealed_at.asc().nulls_last(),
                    generations.c.order_id.asc().nulls_last(),
                ),
            ),
            generations.c.sealed_at,
        ),
    )


async def insert_buckets(
    session: AsyncSession,
    reducer: Reducer,
    start: datetime,
    end: datetime,
    *event_clauses: ColumnElement[bool],
) -> int:
    statement = build_bucket_insert(reducer, start, end, *event_clauses)
    result: CursorResult[Any] = await session.execute(statement)  # type: ignore[assignment]
    return result.rowcount


async def insert_empty_bucket(
    session: AsyncSession,
    reducer: Reducer,
    identity: Identity,
    interval: Interval,
    *,
    sealed_at: datetime | None,
) -> None:
    customer_id, external_customer_id = identity
    bucket_start, bucket_end = interval
    await session.execute(
        insert(ReducerBucket).values(
            organization_id=reducer.organization_id,
            reducer_id=reducer.id,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            bucket_start=bucket_start,
            bucket_end=bucket_end,
            count=0,
            sum=0,
            generation=1,
            sealed_at=sealed_at,
        )
    )


async def backfill_buckets(
    session: AsyncSession,
    reducer: Reducer,
    start: datetime,
    end: datetime,
    *,
    customer_id: UUID | None = None,
) -> int:
    """Rebuilds the buckets in [start, end), which must be bucket-aligned."""
    for setting in WINDOW_SETTINGS:
        await session.execute(text(setting))
    deleted_rows = await delete_bucket_rows(
        session, reducer, start, end, customer_id=customer_id
    )
    deleted_by_bucket: dict[datetime, list[DeletedBucket]] = defaultdict(list)
    for deleted in deleted_rows:
        deleted_by_bucket[floor_bucket(deleted.interval[0])].append(deleted)
    split_intervals = {
        (identity, bucket_start): intervals
        for bucket_start, deleted in deleted_by_bucket.items()
        for identity, intervals in get_split_intervals(
            bucket_start, bucket_start + BUCKET_SIZE, deleted
        ).items()
    }

    unsplit_clauses = [
        ~and_(
            is_identity(Event, identity),
            Event.timestamp >= bucket_start,
            Event.timestamp < bucket_start + BUCKET_SIZE,
        )
        for identity, bucket_start in split_intervals
    ]
    if customer_id is not None:
        unsplit_clauses.append(is_in_customer_scope(Event, reducer, customer_id))
    rows_written = await insert_buckets(session, reducer, start, end, *unsplit_clauses)

    for (identity, _), intervals in split_intervals.items():
        for interval_start, interval_end in intervals:
            interval_rows = await insert_buckets(
                session,
                reducer,
                interval_start,
                interval_end,
                is_identity(Event, identity),
            )
            # Live writes only aggregate into a split slot's existing intervals,
            # so an empty side still needs its row.
            if interval_rows == 0:
                await insert_empty_bucket(
                    session,
                    reducer,
                    identity,
                    (interval_start, interval_end),
                    sealed_at=get_latest_sealed_at(
                        deleted_rows, identity, interval_start
                    ),
                )
                interval_rows = 1
            rows_written += interval_rows
    return rows_written


@cli.command()
@typer_async
async def backfill(
    start: datetime,
    end: datetime,
    organization_id: UUID | None = None,
    meter_id: UUID | None = None,
    customer_id: UUID | None = None,
    window_hours: int = typer.Option(24, min=1),
) -> None:
    """Rebuild usage and billing buckets, excluding the latest ten minutes.

    Expands START/END to full buckets; naive timestamps are UTC.
    Replaces all generations in the selected scope, including sealed ones,
    keeping the bucket splits made when they were sealed.
    """
    start, end = bucket_range(start, end)
    configure_script_logging()
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    rows_written = 0
    try:
        async with sessionmaker() as session:
            reducers = await get_reducers(
                session, organization_id=organization_id, meter_id=meter_id
            )
        typer.echo(f"Backfilling [{start.isoformat()}, {end.isoformat()})")
        for reducer in reducers:
            if isinstance(reducer.aggregation, UniqueAggregation):
                typer.echo(f"Skipping unique reducer {reducer.id}")
                continue
            window_start = start
            while window_start < end:
                window_end = min(window_start + timedelta(hours=window_hours), end)
                async with sessionmaker.begin() as session:
                    rows_written += await backfill_buckets(
                        session,
                        reducer,
                        window_start,
                        window_end,
                        customer_id=customer_id,
                    )
                typer.echo(
                    f"Reducer {reducer.id}: up to {window_end.isoformat()}, "
                    f"{rows_written} rows written"
                )
                window_start = window_end
        typer.echo(f"Wrote {rows_written} reducer bucket rows.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
