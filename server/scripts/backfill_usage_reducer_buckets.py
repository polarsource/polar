from bisect import bisect_left, bisect_right
from collections import defaultdict
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from itertools import pairwise
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
    literal,
    null,
    or_,
    select,
)

from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.meter.aggregation import PropertyAggregation, UniqueAggregation
from polar.models import (
    BillingEntry,
    BillingInterval,
    Customer,
    Event,
    MeterReducer,
    Order,
    OrderItem,
    Organization,
    ProductPrice,
    Reducer,
    ReducerBucket,
)
from polar.models.billing_entry import BillingEntryType
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.organization.repository import SUBSCRIPTION_CANCELLATION_STATUSES
from polar.postgres import create_async_engine
from polar.reducer.bucket_repository import INGESTED_BEFORE_TIMESTAMP_MARGIN
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
are split at, like live seals and bills split them: each billing interval's start
and end, and each meter reset."""
type Slot = tuple[UUID, datetime, UUID | None, str | None]
"""reducer_id, bucket_start of the slot, customer_id, external_customer_id"""


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


@dataclass
class Usage:
    billings: set[Billing] = field(default_factory=set)
    """The orders that billed some of the bucket's usage."""
    values: list[tuple[datetime, Decimal]] = field(default_factory=list)
    """ingested_at and value of each of the bucket's events."""


type Totals = dict[BucketKey, Usage]


async def backfill_organization(
    session: AsyncSession,
    organization_id: UUID,
    start: datetime,
    end: datetime,
    *,
    page_size: int = PAGE_SIZE,
) -> int:
    """Rebuilds the buckets of all the organization's usage reducers starting in
    [start, end) from one pass over its events, and returns how many were written."""
    reducers = await _get_reducers(session, organization_id)
    boundaries, split_slots = await _get_boundaries(
        session, organization_id, reducers, start, end
    )
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
            session,
            organization_id,
            reducers,
            totals,
            boundaries,
            split_slots,
            flushed_until,
            flush_until,
            end,
        )
        flushed_until = flush_until
        await session.commit()
        seen += len(rows)
        typer.echo(
            f"{utc_now():%H:%M:%S}  {seen:,} events, {written:,} buckets, "
            f"flushed until {flushed_until.isoformat()}"
        )
    written += await _flush(
        session,
        organization_id,
        reducers,
        totals,
        boundaries,
        split_slots,
        flushed_until,
        end,
        end,
    )
    await session.commit()
    return written


async def _iter_events(
    session: AsyncSession,
    organization_id: UUID,
    reducers: Sequence[Reducer],
    start: datetime,
    end: datetime,
    page_size: int,
) -> AsyncIterator[Sequence[Row[*tuple[Any, ...]]]]:
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
    reducers: Sequence[Reducer],
    totals: Totals,
    boundaries: Boundaries,
    split_slots: set[Slot],
    start: datetime,
    end: datetime,
    synced_at: datetime,
) -> int:
    """Replaces the reducers' buckets starting in [start, end) with the totals of
    those buckets, which it drops from `totals`."""
    _add_empty_intervals(totals, reducers, boundaries, split_slots, start, end)
    completed = _pop_totals_before(totals, end)
    buckets = _to_buckets(organization_id, completed, synced_at)
    await _delete_buckets(session, organization_id, reducers, start, end)
    await _insert_buckets(session, buckets)
    return len(buckets)


async def _get_organization_ids(
    session: AsyncSession, organization_id: UUID | None, after: UUID | None
) -> Sequence[UUID]:
    """The organizations still billing with active usage reducers, or the given
    one. A deleted organization, or one whose subscriptions are cancelled, never
    bills its usage again."""
    if organization_id is not None:
        return [organization_id]
    statement = (
        ReducerRepository.from_session(session)
        .get_active_statement((ReducerKind.usage,))
        .with_only_columns(Reducer.organization_id)
        .join(Organization, Organization.id == Reducer.organization_id)
        .where(
            Organization.deleted_at.is_(None),
            Organization.status.not_in(SUBSCRIPTION_CANCELLATION_STATUSES),
        )
        .distinct()
        .order_by(Reducer.organization_id)
    )
    if after is not None:
        statement = statement.where(Reducer.organization_id > after)
    return (await session.scalars(statement)).all()


async def _get_reducers(
    session: AsyncSession, organization_id: UUID
) -> Sequence[Reducer]:
    """The organization's active usage reducers with a mergeable aggregation."""
    reducers = await ReducerRepository.from_session(
        session
    ).get_all_active_by_organization_and_kinds(organization_id, (ReducerKind.usage,))
    return [
        reducer
        for reducer in reducers
        if not isinstance(reducer.aggregation, UniqueAggregation)
    ]


async def _get_boundaries(
    session: AsyncSession,
    organization_id: UUID,
    reducers: Sequence[Reducer],
    start: datetime,
    end: datetime,
) -> tuple[Boundaries, set[Slot]]:
    """The timestamps in [start, end) the reducers' buckets are split at, per
    customer and reducer, with the customer's external id as an alternate key, and
    the slots they split for each of the customer's identities. Only those can
    split a bucket starting in [start, end)."""
    reducer_ids_by_meter: dict[UUID, list[UUID]] = defaultdict(list)
    for meter_id, reducer_id in await session.execute(
        select(MeterReducer.meter_id, MeterReducer.reducer_id).where(
            MeterReducer.reducer_id.in_([reducer.id for reducer in reducers])
        )
    ):
        reducer_ids_by_meter[meter_id].append(reducer_id)
    meter_ids = list(reducer_ids_by_meter)
    resets = await session.execute(
        select(
            Customer.id,
            Customer.external_id,
            Event.user_metadata["meter_id"].as_string(),
            Event.timestamp,
        )
        .join(Customer, Customer.id == Event.customer_id)
        .where(
            Event.organization_id == organization_id,
            Event.source == EventSource.system,
            Event.name == SystemEvent.meter_reset,
            Event.user_metadata["meter_id"]
            .as_string()
            .in_([str(meter_id) for meter_id in meter_ids]),
            Event.timestamp >= start,
            Event.timestamp < end,
            # A reset is never timestamped after its ingestion: this bound lets
            # the name index skip the organization's older resets.
            Event.ingested_at >= start - INGESTED_BEFORE_TIMESTAMP_MARGIN,
        )
    )
    intervals = await session.execute(
        select(
            Customer.id,
            Customer.external_id,
            BillingInterval.meter_id,
            BillingInterval.period_start,
            BillingInterval.period_end,
        )
        .join(Customer, Customer.id == BillingInterval.customer_id)
        .where(
            BillingInterval.organization_id == organization_id,
            BillingInterval.meter_id.in_(meter_ids),
            or_(
                and_(
                    BillingInterval.period_start >= start,
                    BillingInterval.period_start < end,
                ),
                and_(
                    BillingInterval.period_end >= start,
                    BillingInterval.period_end < end,
                ),
            ),
        )
    )
    boundaries: Boundaries = {}
    split_slots: set[Slot] = set()

    def add(
        customer_id: UUID, external_id: str | None, meter_id: UUID, at: datetime
    ) -> None:
        if not start <= at < end:
            return
        slot = get_reducer_bucket_start(at)
        # Like seals and bills, which split every identity of the customer.
        identities: list[tuple[UUID | None, str | None]] = [(customer_id, None)]
        if external_id is not None:
            identities += [(None, external_id), (customer_id, external_id)]
        for reducer_id in reducer_ids_by_meter[meter_id]:
            boundaries.setdefault((customer_id, reducer_id), []).append(at)
            if external_id is not None:
                boundaries.setdefault((external_id, reducer_id), []).append(at)
            if at != slot:
                split_slots.update(
                    (reducer_id, slot, identity_customer_id, identity_external_id)
                    for identity_customer_id, identity_external_id in identities
                )

    for customer_id, external_id, meter_id, at in resets:
        add(customer_id, external_id, UUID(meter_id), at)
    for customer_id, external_id, meter_id, period_start, period_end in intervals:
        add(customer_id, external_id, meter_id, period_start)
        if period_end is not None:
            add(customer_id, external_id, meter_id, period_end)
    return {key: sorted(set(ats)) for key, ats in boundaries.items()}, split_slots


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
) -> Sequence[Row[*tuple[Any, ...]]]:
    """Up to `page_size` of the organization's user events with a timestamp in
    [start, end) and (timestamp, id) after `after`, in that order: the event's
    id, timestamp, ingestion time and customer identity, then its value for each
    reducer."""
    statement = (
        select(
            Event.id,
            Event.timestamp,
            Event.ingested_at,
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


def _matched_event_ids(rows: Sequence[Row[*tuple[Any, ...]]]) -> list[UUID]:
    """The events with a value for at least one reducer."""
    return [
        id
        for id, _, _, _, _, *values in rows
        if any(value is not None for value in values)
    ]


def _add_to_totals(
    totals: Totals,
    reducers: Sequence[Reducer],
    rows: Sequence[Row[*tuple[Any, ...]]],
    billed_at: dict[tuple[UUID, UUID], Billing],
    boundaries: Boundaries,
) -> None:
    """Adds each event's value to the bucket of every reducer it matches, and the
    order that billed it for that reducer to the bucket's billings."""
    for row in rows:
        id, timestamp, ingested_at, customer_id, external_customer_id, *values = row
        bucket_start = get_reducer_bucket_start(timestamp)
        customer_key = customer_id if customer_id is not None else external_customer_id
        for reducer, value in zip(reducers, values, strict=True):
            if value is None:
                continue
            start, end = _get_interval(
                boundaries.get((customer_key, reducer.id), []), bucket_start, timestamp
            )
            key = (reducer.id, start, end, customer_id, external_customer_id)
            usage = totals.setdefault(key, Usage())
            usage.values.append((ingested_at, Decimal(str(value))))
            billing = billed_at.get((id, reducer.id))
            if billing is not None:
                usage.billings.add(billing)


def _add_empty_intervals(
    totals: Totals,
    reducers: Sequence[Reducer],
    boundaries: Boundaries,
    split_slots: set[Slot],
    start: datetime,
    end: datetime,
) -> None:
    """Adds an empty bucket for each interval of the slots in [start, end) with
    usage or a boundary that has none, like a split creates them: sync only
    recomputes a slot's existing intervals, so a missing one would never count
    its late events."""
    reducer_ids = {reducer.id for reducer in reducers}
    slots: set[Slot] = {
        (
            reducer_id,
            get_reducer_bucket_start(bucket_start),
            customer_id,
            external_customer_id,
        )
        for reducer_id, bucket_start, _, customer_id, external_customer_id in totals
        if bucket_start < end
    } | {
        slot
        for slot in split_slots
        if slot[0] in reducer_ids and start <= slot[1] < end
    }
    for reducer_id, slot_start, customer_id, external_customer_id in slots:
        customer_key = customer_id if customer_id is not None else external_customer_id
        assert customer_key is not None
        slot_boundaries = [
            at
            for at in boundaries.get((customer_key, reducer_id), [])
            if slot_start < at < slot_start + REDUCER_BUCKET_SIZE
        ]
        for interval_start, interval_end in pairwise(
            [slot_start, *slot_boundaries, slot_start + REDUCER_BUCKET_SIZE]
        ):
            totals.setdefault(
                (
                    reducer_id,
                    interval_start,
                    interval_end,
                    customer_id,
                    external_customer_id,
                ),
                Usage(),
            )


def _pop_totals_before(totals: Totals, end: datetime) -> Totals:
    """Removes and returns the totals of the buckets starting before `end`."""
    completed = [key for key in totals if key[1] < end]
    return {key: totals.pop(key) for key in completed}


def _to_buckets(
    organization_id: UUID, totals: Totals, synced_at: datetime
) -> list[BucketValues]:
    """Bucket rows to insert: each order that billed some of a bucket's usage
    sealed it at the order's created_at, and each seal starts a new generation,
    like `reducer_bucket.sync` splits them: by ingestion time. A generation holds
    the events ingested since the previous seal until its own, sealed and billed
    by its order; the last one, unsealed, those ingested after the last seal."""
    buckets: list[BucketValues] = []
    for (
        reducer_id,
        bucket_start,
        bucket_end,
        customer_id,
        external_customer_id,
    ), usage in totals.items():
        for generation, (billing, summary) in enumerate(_get_generations(usage), 1):
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


def _get_generations(usage: Usage) -> list[tuple[Billing | None, Summary]]:
    """The bucket's non-empty generations in order, each with the order that
    sealed it, or None for the unsealed one: a single empty, unsealed one for a
    bucket without usage."""
    seals: list[Billing | None] = [*sorted(usage.billings), None]
    sealed_at = [created_at for created_at, _ in sorted(usage.billings)]
    summaries = [Summary() for _ in seals]
    for ingested_at, value in usage.values:
        summaries[bisect_left(sealed_at, ingested_at)].add(value)
    return [
        (billing, summary)
        for billing, summary in zip(seals, summaries, strict=True)
        if summary.count
    ] or [(None, Summary())]


async def _delete_buckets(
    session: AsyncSession,
    organization_id: UUID,
    reducers: Sequence[Reducer],
    start: datetime,
    end: datetime,
) -> None:
    await session.execute(
        delete(ReducerBucket).where(
            ReducerBucket.organization_id == organization_id,
            ReducerBucket.reducer_id.in_([reducer.id for reducer in reducers]),
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
    """Rebuild usage reducer buckets, excluding the latest ten minutes."""
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
