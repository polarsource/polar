import math
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import logfire
import structlog
from redis.exceptions import RedisError
from sqlalchemy import Row

from polar.event.repository import EventRepository
from polar.kit.db.postgres import AsyncReadSession
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.meter.aggregation import (
    AggregationFunction,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.models import (
    Customer,
    CustomerMeter,
    Event,
    Meter,
    MeterReducer,
    Reducer,
    ReducerBucket,
)
from polar.models.reducer import ReducerKind
from polar.outpost.stream import enqueue as enqueue_outpost_event
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.worker import enqueue_job

from . import cache, redis_store
from .bucket_repository import ReducerBucketRepository
from .repository import ReducerRepository

log: Logger = structlog.get_logger()

REDUCER_BUCKET_SIZE = timedelta(minutes=5)
# Buckets are in Postgres after 10 minutes, and billing waits 15: sealing
# normally runs in between.
SEAL_DELAY = timedelta(minutes=11)

type Contributions = dict[redis_store.BucketId, list[tuple[datetime, Decimal]]]
# What an event adds to a count reducer.
ONE = Decimal(1)


def get_reducer_bucket_start(timestamp: datetime) -> datetime:
    size = int(REDUCER_BUCKET_SIZE.total_seconds())
    epoch = int(timestamp.timestamp())
    return datetime.fromtimestamp(epoch - epoch % size, tz=UTC)


def get_customer_identities(
    customer: Customer,
) -> list[tuple[UUID | None, str | None]]:
    """The (customer_id, external_customer_id) pairs the customer's buckets use."""
    return _get_identities(customer.id, customer.external_id)


def _get_identities(
    customer_id: UUID | None, external_customer_id: str | None
) -> list[tuple[UUID | None, str | None]]:
    identities: list[tuple[UUID | None, str | None]] = []
    if customer_id is not None:
        identities.append((customer_id, None))
    if external_customer_id is not None:
        identities.append((None, external_customer_id))
    if customer_id is not None and external_customer_id is not None:
        identities.append((customer_id, external_customer_id))
    return identities


class ReducerService:
    def enqueue_seal(self, customer_id: UUID, meter_id: UUID, *, at: datetime) -> None:
        """Seals the customer's usage before `at` once it has all reached Postgres,
        before billing gets to it."""
        delay = at + SEAL_DELAY - utc_now()
        enqueue_job(
            "reducer.seal",
            customer_id,
            meter_id,
            at.isoformat(),
            delay=max(int(delay.total_seconds() * 1000), 0),
        )

    async def seal(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_id: UUID,
        *,
        at: datetime,
    ) -> None:
        """Makes `at` a bucket boundary and seals the customer's usage before it."""
        try:
            async with session.begin_nested():
                reducers = await self._get_reducers(session, [meter_id])
                await self._seal_buckets(
                    session, list(reducers.values()), customer, until=at
                )
        except Exception:
            log.exception(
                "Failed to seal reducer buckets",
                customer_id=customer.id,
                meter_id=meter_id,
                at=at.isoformat(),
            )

    async def bill(
        self,
        session: AsyncSession,
        customer: Customer,
        meter_ids: Iterable[UUID],
        *,
        order_id: UUID,
        billable_from: datetime,
        cutoff: datetime,
    ) -> dict[UUID, Decimal]:
        """Marks the customer's usage within [billable_from, cutoff] as billed by
        the order, and returns its quantity per meter."""
        meter_ids = sorted(meter_ids)
        try:
            async with session.begin_nested():
                reducers = await self._get_reducers(session, meter_ids)
                # The meter.reset at `cutoff` should have sealed this usage already.
                # That task and this run at roughly the same time, so if it
                # hasn't run already we seal it here. The one that runs
                # afterward becomes a no-op.
                await self._seal_buckets(
                    session,
                    list(reducers.values()),
                    customer,
                    since=billable_from,
                    until=cutoff,
                )
                quantities = await self._bill_buckets(
                    session,
                    list(reducers.values()),
                    customer,
                    order_id=order_id,
                    since=billable_from,
                    until=cutoff,
                )
        except Exception:
            log.exception(
                "Failed to bill reducer buckets",
                customer_id=customer.id,
                meter_ids=meter_ids,
                order_id=order_id,
                cutoff=cutoff.isoformat(),
            )
            return {}
        return {
            meter_id: quantities[reducer.id]
            for meter_id, reducer in reducers.items()
            if reducer.id in quantities
        }

    async def sync_meter(self, session: AsyncSession, meter: Meter) -> Reducer:
        repository = ReducerRepository.from_session(session)
        meter = await repository.get_meter_for_update(meter.id)
        reducer = await repository.get_by_meter_and_kind(meter.id, ReducerKind.usage)
        if reducer is not None:
            return await repository.update(
                reducer,
                update_dict={"filter": meter.filter, "aggregation": meter.aggregation},
            )

        reducer = await repository.create(
            Reducer(
                organization=meter.organization,
                filter=meter.filter,
                aggregation=meter.aggregation,
            )
        )
        session.add(MeterReducer(meter=meter, reducer=reducer))
        return reducer

    async def rollup(
        self,
        session: AsyncSession,
        redis: Redis,
        organization_id: UUID,
        events: Sequence[Event],
    ) -> int:
        """Returns the number of reducer buckets the events contributed to."""
        reducers = [
            reducer
            for reducer in await cache.get_active_reducers(
                session, redis, organization_id
            )
            if not isinstance(reducer.aggregation, UniqueAggregation)
        ]
        if not reducers:
            return 0

        now = utc_now()
        current_bucket_start = get_reducer_bucket_start(now)
        oldest_active_bucket_start = current_bucket_start - REDUCER_BUCKET_SIZE
        contributions = _reduce_events_to_bucket_contributions(reducers, events)
        contributions_to_active_buckets = {
            bucket_id: [value for _, value in values]
            for bucket_id, values in contributions.items()
            if bucket_id[1] >= oldest_active_bucket_start
        }
        if contributions_to_active_buckets:
            # Roll up active events into buckets in Redis
            try:
                await redis_store.add_to_buckets(redis, contributions_to_active_buckets)
            except RedisError:
                log.exception(
                    "Failed to update active reducer buckets in Redis",
                    organization_id=organization_id,
                    bucket_count=len(contributions_to_active_buckets),
                    event_count=len(events),
                )
            else:
                log.info(
                    "Active reducer buckets updated in Redis",
                    organization_id=organization_id,
                    bucket_count=len(contributions_to_active_buckets),
                    event_count=len(events),
                )

        contributions_to_closed_buckets = {
            bucket_id: values
            for bucket_id, values in contributions.items()
            if bucket_id[1] < current_bucket_start
        }
        if contributions_to_closed_buckets:
            await self._add_to_closed_buckets(session, contributions_to_closed_buckets)

        for reducer, bucket_start, customer_id, external_customer_id in contributions:
            if bucket_start < current_bucket_start:
                continue
            # Current buckets are only in Redis: persist them once they close.
            delay = bucket_start + REDUCER_BUCKET_SIZE - now
            enqueue_job(
                "reducer_bucket.sync",
                reducer.id,
                bucket_start.isoformat(),
                customer_id,
                external_customer_id,
                delay=int(delay.total_seconds() * 1000),
            )

        return len(contributions)

    async def sync_bucket(
        self,
        session: AsyncSession,
        reducer_id: UUID,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> None:
        reducer = await ReducerRepository.from_session(session).get_active_by_id(
            reducer_id
        )
        if reducer is None:
            return
        repository = ReducerBucketRepository.from_session(session)
        await self._lock_buckets(
            repository, [(reducer, bucket_start, customer_id, external_customer_id)]
        )
        await self._sync_bucket_intervals(
            repository, reducer, bucket_start, customer_id, external_customer_id
        )
        _enqueue_outpost_event(reducer, customer_id, external_customer_id)

    async def get_cold_usage(
        self,
        session: AsyncReadSession,
        reducer: Reducer,
        customer_id: UUID | None,
        external_customer_id: str | None,
        *,
        since: datetime,
    ) -> tuple[datetime, Row[Any]]:
        """The end of the customer identity's last fully synced slot starting from
        `since`, or `since`, with the count, sum, min and max of its usage not
        billed yet before it. Clients count whole slots: a slot a seal split, with
        only its first part synced, stays theirs."""
        repository = ReducerBucketRepository.from_session(session)
        synced_end = await repository.get_last_synced_end(
            reducer.organization_id,
            reducer.id,
            customer_id,
            external_customer_id,
            since=since,
        )
        cold_until = get_reducer_bucket_start(synced_end) if synced_end else since
        totals = await repository.get_unsealed_totals(
            reducer.organization_id,
            reducer.id,
            [(customer_id, external_customer_id)],
            before=cold_until,
        )
        return cold_until, totals

    async def get_stored_external_ids(
        self,
        session: AsyncReadSession,
        reducer: Reducer,
        customer_id: UUID | None,
        external_customer_id: str | None,
        *,
        bucket_start: datetime,
        external_ids: Sequence[str],
    ) -> set[str]:
        """The given external ids of the customer identity's stored events that the
        synced part of the bucket starting at `bucket_start` counts: a seal can
        split a bucket, and sync then recomputes each part on its own."""
        repository = ReducerBucketRepository.from_session(session)
        synced_end = await repository.get_synced_end_within(
            reducer.organization_id,
            reducer.id,
            customer_id,
            external_customer_id,
            bucket_start,
            bucket_start + REDUCER_BUCKET_SIZE,
        )
        if synced_end is None:
            return set()
        return await EventRepository.from_session(session).get_stored_external_ids(
            reducer.organization_id,
            external_ids,
            timestamp_from=bucket_start,
            timestamp_to=synced_end,
        )

    async def get_database_now(self, session: AsyncReadSession) -> datetime:
        return await ReducerBucketRepository.from_session(session).get_database_now()

    async def get_customer_value(
        self,
        session: AsyncReadSession,
        redis: Redis,
        reducer: Reducer,
        customer_id: UUID | None,
        external_customer_id: str | None,
        *,
        since: datetime | None = None,
    ) -> Decimal:
        """The customer's usage in the buckets starting at or after `since`."""
        identities = _get_identities(customer_id, external_customer_id)
        if not identities:
            raise ValueError("customer_id or external_customer_id is required")
        current_bucket_start = get_reducer_bucket_start(utc_now())
        previous_bucket_start = current_bucket_start - REDUCER_BUCKET_SIZE

        totals: list[tuple[Any, ...]] = []

        if since is None or since < previous_bucket_start:
            closed = await ReducerBucketRepository.from_session(
                session
            ).get_totals_starting_within(
                reducer.organization_id,
                reducer.id,
                identities,
                since,
                previous_bucket_start,
            )
            totals.append(tuple(closed))

        active_bucket_starts = [
            bucket_start
            for bucket_start in (previous_bucket_start, current_bucket_start)
            if since is None or bucket_start >= since
        ]
        if active_bucket_starts:
            totals += await redis_store.get_bucket_totals(
                redis, reducer, active_bucket_starts, identities
            )

        return _get_quantity(reducer.aggregation.func, totals)

    async def log_customer_meter_comparison(
        self, session: AsyncReadSession, redis: Redis, customer_meter: CustomerMeter
    ) -> None:
        """Logs the customer meter's consumed units next to the reducer's value
        since the meter's latest reset."""
        customer = customer_meter.customer
        with logfire.span(
            "Compare customer meter with reducer",
            organization_id=str(customer.organization_id),
            customer_meter_id=str(customer_meter.id),
        ) as span:
            try:
                async with session.begin_nested():
                    reducer = await ReducerRepository.from_session(
                        session
                    ).get_by_meter_and_kind(customer_meter.meter_id, ReducerKind.usage)
                    if reducer is None or isinstance(
                        reducer.aggregation, UniqueAggregation
                    ):
                        return
                    meter_reset_event = await EventRepository.from_session(
                        session
                    ).get_latest_meter_reset(customer, customer_meter.meter_id)
                    since = (
                        meter_reset_event.timestamp
                        if meter_reset_event is not None
                        else None
                    )
                    span.set_attribute("reducer_id", str(reducer.id))
                    span.set_attribute("aggregation", str(reducer.aggregation.func))
                    span.set_attribute("since", since)
                    value = await self.get_customer_value(
                        session,
                        redis,
                        reducer,
                        customer.id,
                        customer.external_id,
                        since=since,
                    )
                    span.set_attribute("legacy", str(customer_meter.consumed_units))
                    span.set_attribute("reducer", str(value))
                    span.set_attribute(
                        "match", math.isclose(value, customer_meter.consumed_units)
                    )
            except Exception:
                log.exception(
                    "Failed to compare customer meter with reducer",
                    customer_meter_id=customer_meter.id,
                )

    async def _add_to_closed_buckets(
        self, session: AsyncSession, contributions: Contributions
    ) -> None:
        repository = ReducerBucketRepository.from_session(session)
        # Locks are all taken before writing any row, and rows are written in
        # chronological order like seal locks them, so a seal can't deadlock with us.
        bucket_ids = sorted(contributions, key=_get_bucket_key)
        await self._lock_buckets(repository, bucket_ids)
        for bucket_id in bucket_ids:
            reducer, bucket_start, customer_id, external_customer_id = bucket_id
            for start, end in await self._get_intervals(
                repository, reducer, bucket_start, customer_id, external_customer_id
            ):
                values = [
                    value
                    for timestamp, value in contributions[bucket_id]
                    if start <= timestamp < end
                ]
                if not values:
                    continue
                statistics = (
                    {
                        "total": sum(values, Decimal(0)),
                        "minimum": min(values),
                        "maximum": max(values),
                    }
                    if isinstance(reducer.aggregation, PropertyAggregation)
                    else {}
                )
                await repository.add_contribution(
                    reducer,
                    start,
                    end,
                    customer_id,
                    external_customer_id,
                    count=len(values),
                    **statistics,
                )
            _enqueue_outpost_event(reducer, customer_id, external_customer_id)

    async def _get_reducers(
        self, session: AsyncSession, meter_ids: Iterable[UUID]
    ) -> dict[UUID, Reducer]:
        """The meters' reducers with buckets, by meter id."""
        repository = ReducerRepository.from_session(session)
        reducers: dict[UUID, Reducer] = {}
        for meter_id in meter_ids:
            reducer = await repository.get_by_meter_and_kind(
                meter_id, ReducerKind.usage
            )
            if reducer is not None and not isinstance(
                reducer.aggregation, UniqueAggregation
            ):
                reducers[meter_id] = reducer
        return reducers

    async def _seal_buckets(
        self,
        session: AsyncSession,
        reducers: Sequence[Reducer],
        customer: Customer,
        *,
        until: datetime,
        since: datetime | None = None,
    ) -> None:
        """Seals the customer's unsealed usage until `until`, from `since` if
        given, making both bucket boundaries."""
        repository = ReducerBucketRepository.from_session(session)
        identities = get_customer_identities(customer)
        boundaries = [until] if since is None else sorted({since, until})
        await self._lock_buckets(
            repository,
            [
                (
                    reducer,
                    get_reducer_bucket_start(at),
                    customer_id,
                    external_customer_id,
                )
                for at in boundaries
                for reducer in reducers
                for customer_id, external_customer_id in identities
            ],
        )

        for reducer in sorted(reducers, key=lambda reducer: str(reducer.id)):
            for customer_id, external_customer_id in identities:
                await self._split_at(
                    repository,
                    reducer,
                    customer,
                    (customer_id, external_customer_id),
                    boundaries,
                )
            with logfire.span(
                "Seal reducer buckets",
                organization_id=str(customer.organization_id),
                reducer_id=str(reducer.id),
                customer_id=str(customer.id),
                until=until,
            ) as span:
                sealed = await repository.mark_as_sealed(
                    reducer, identities, since=since, until=until, sealed_at=utc_now()
                )
                span.set_attribute("sealed_buckets", sealed)

    async def _split_at(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        customer: Customer,
        identity: tuple[UUID | None, str | None],
        boundaries: Sequence[datetime],
    ) -> None:
        """Makes each boundary a bucket boundary of the customer identity."""
        customer_id, external_customer_id = identity
        for at in boundaries:
            with logfire.span(
                "Split reducer buckets",
                organization_id=str(customer.organization_id),
                reducer_id=str(reducer.id),
                customer_id=str(customer.id),
                bucket_customer_id=customer_id is not None,
                bucket_external_customer_id=external_customer_id is not None,
                at=at,
            ) as span:
                start, end = await self._get_interval_containing(
                    repository, reducer, customer_id, external_customer_id, at
                )
                split = False
                if start != at:
                    split = await self._split(
                        repository,
                        reducer,
                        customer_id,
                        external_customer_id,
                        (start, end),
                        split_at=at,
                    )
                span.set_attribute("interval", [start.isoformat(), end.isoformat()])
                span.set_attribute("split", split)

    async def _bill_buckets(
        self,
        session: AsyncSession,
        reducers: Sequence[Reducer],
        customer: Customer,
        *,
        order_id: UUID,
        since: datetime,
        until: datetime,
    ) -> dict[UUID, Decimal]:
        """Marks the customer's sealed, unbilled usage within [since, until] as
        billed by the order and returns its quantity per reducer."""
        repository = ReducerBucketRepository.from_session(session)
        identities = get_customer_identities(customer)
        quantities: dict[UUID, Decimal] = {}
        for reducer in sorted(reducers, key=lambda reducer: str(reducer.id)):
            with logfire.span(
                "Bill reducer buckets",
                organization_id=str(customer.organization_id),
                reducer_id=str(reducer.id),
                customer_id=str(customer.id),
                order_id=str(order_id),
                since=since,
                until=until,
            ) as span:
                billed = await repository.mark_as_billed(
                    reducer,
                    identities,
                    order_id,
                    since=since,
                    until=until,
                    billed_at=utc_now(),
                )
                quantity = _get_quantity(reducer.aggregation.func, billed)
                span.set_attribute("billed_buckets", len(billed))
                span.set_attribute("quantity", str(quantity))
            quantities[reducer.id] = quantity
        return quantities

    async def _lock_buckets(
        self,
        repository: ReducerBucketRepository,
        bucket_ids: Iterable[redis_store.BucketId],
    ) -> None:
        """Locks the buckets in one global order, so transactions locking several
        can't deadlock each other."""
        for bucket_id in sorted(bucket_ids, key=_get_bucket_key):
            await repository.lock_buckets(*bucket_id)

    async def _get_intervals(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> list[tuple[datetime, datetime]]:
        """The [start, end) intervals the slot's rows divide it into, or the whole
        slot if it has none."""
        buckets = await repository.get_all_starting_within(
            reducer,
            bucket_start,
            bucket_start + REDUCER_BUCKET_SIZE,
            customer_id,
            external_customer_id,
        )
        return sorted(
            {(bucket.bucket_start, bucket.bucket_end) for bucket in buckets}
        ) or [(bucket_start, bucket_start + REDUCER_BUCKET_SIZE)]

    async def _sync_bucket_intervals(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: UUID | None,
        external_customer_id: str | None,
    ) -> None:
        for start, end in await self._get_intervals(
            repository, reducer, bucket_start, customer_id, external_customer_id
        ):
            previous = await repository.get_latest_for_update(
                reducer, start, customer_id, external_customer_id
            )
            count, total, minimum, maximum = await repository.aggregate_events(
                reducer, start, end, customer_id, external_customer_id
            )
            if count == 0:
                continue
            statistics = {"count": count, "sum": total, "min": minimum, "max": maximum}
            # Sealed buckets were billed: events since go to a new generation.
            if previous is not None and previous.sealed_at is None:
                await repository.update(
                    previous, update_dict={**statistics, "synced_at": utc_now()}
                )
                continue
            await repository.create(
                ReducerBucket(
                    organization_id=reducer.organization_id,
                    reducer=reducer,
                    customer_id=customer_id,
                    external_customer_id=external_customer_id,
                    bucket_start=start,
                    bucket_end=end,
                    **statistics,
                    generation=1 if previous is None else previous.generation + 1,
                    synced_at=utc_now(),
                ),
                flush=True,
            )

    async def _get_interval_containing(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        customer_id: UUID | None,
        external_customer_id: str | None,
        at: datetime,
    ) -> tuple[datetime, datetime]:
        intervals = await self._get_intervals(
            repository,
            reducer,
            get_reducer_bucket_start(at),
            customer_id,
            external_customer_id,
        )
        return next((start, end) for start, end in intervals if start <= at < end)

    async def _split(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        customer_id: UUID | None,
        external_customer_id: str | None,
        interval: tuple[datetime, datetime],
        *,
        split_at: datetime,
    ) -> bool:
        """Makes `split_at` a bucket boundary, so a seal can include the usage on
        one side of it only: `interval`, which contains it, becomes
        [interval_start, split_at) and [split_at, interval_end), created empty
        if the bucket doesn't exist yet."""
        interval_start, interval_end = interval
        bucket = await repository.get_latest_for_update(
            reducer, interval_start, customer_id, external_customer_id
        )
        # An earlier seal went past `split_at`. Sealed rows can't change.
        if bucket is not None and bucket.sealed_at is not None:
            log.warning(
                "Skipping split of a sealed reducer bucket",
                reducer_id=reducer.id,
                bucket_start=interval_start.isoformat(),
                split_at=split_at.isoformat(),
            )
            return False
        # Same, but late events arrived after that seal and opened a new generation.
        # Splitting it would leave its generations covering different intervals.
        if bucket is not None and bucket.generation > 1:
            log.warning(
                "Skipping split of a reducer bucket with a sealed generation",
                reducer_id=reducer.id,
                bucket_start=interval_start.isoformat(),
                split_at=split_at.isoformat(),
                generation=bucket.generation,
            )
            return False

        before = (
            await repository.aggregate_events(
                reducer, interval_start, split_at, customer_id, external_customer_id
            )
        )._asdict()
        after = (
            await repository.aggregate_events(
                reducer, split_at, interval_end, customer_id, external_customer_id
            )
        )._asdict()
        if bucket is None:
            await repository.create(
                ReducerBucket(
                    organization_id=reducer.organization_id,
                    reducer=reducer,
                    customer_id=customer_id,
                    external_customer_id=external_customer_id,
                    bucket_start=interval_start,
                    bucket_end=split_at,
                    **before,
                ),
                flush=True,
            )
        else:
            await repository.update(
                bucket, update_dict={"bucket_end": split_at, **before}
            )
        await repository.create(
            ReducerBucket(
                organization_id=reducer.organization_id,
                reducer=reducer,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                bucket_start=split_at,
                bucket_end=interval_end,
                **after,
                synced_at=None if bucket is None else bucket.synced_at,
            ),
            flush=True,
        )
        return True


def _enqueue_outpost_event(
    reducer: Reducer,
    customer_id: UUID | None,
    external_customer_id: str | None,
) -> None:
    enqueue_outpost_event(
        reducer.organization_id,
        {
            "type": "reducer_bucket",
            "reducer_id": reducer.id,
            "customer_id": customer_id,
            "external_customer_id": external_customer_id,
        },
    )


def _get_bucket_key(bucket_id: redis_store.BucketId) -> str:
    reducer, bucket_start, customer_id, external_customer_id = bucket_id
    return redis_store.get_reducer_bucket_key(
        reducer.id, bucket_start, customer_id, external_customer_id
    )


def _get_quantity(
    function: AggregationFunction,
    buckets: Sequence[tuple[int, Decimal, Decimal | None, Decimal | None]],
) -> Decimal:
    count = sum(bucket[0] for bucket in buckets)
    total = sum((bucket[1] for bucket in buckets), Decimal(0))
    minimums = [bucket[2] for bucket in buckets if bucket[2] is not None]
    maximums = [bucket[3] for bucket in buckets if bucket[3] is not None]
    match function:
        case AggregationFunction.cnt:
            return Decimal(count)
        case AggregationFunction.sum:
            return total
        case AggregationFunction.avg:
            return total / count if count else Decimal(0)
        case AggregationFunction.min:
            return min(minimums, default=Decimal(0))
        case AggregationFunction.max:
            return max(maximums, default=Decimal(0))
        case AggregationFunction.unique:
            raise ValueError("Unique aggregations have no reducer buckets")


def _reduce_events_to_bucket_contributions(
    reducers: Sequence[Reducer], events: Sequence[Event]
) -> Contributions:
    """The timestamped values each event adds to the buckets of the reducers it
    matches."""
    contributions: Contributions = defaultdict(list)
    prepared = [
        (
            reducer,
            reducer.filter,
            reducer.aggregation
            if isinstance(reducer.aggregation, PropertyAggregation)
            else None,
        )
        for reducer in reducers
    ]
    for event in events:
        timestamp = event.timestamp
        bucket_start = get_reducer_bucket_start(timestamp)
        for reducer, filter, aggregation in prepared:
            if not filter.matches(event):
                continue
            value = ONE
            if aggregation is not None:
                property_value = aggregation.get_value(event)
                if property_value is None:
                    continue
                value = Decimal(str(property_value))
            bucket_id = (
                reducer,
                bucket_start,
                event.customer_id,
                event.external_customer_id,
            )
            contributions[bucket_id].append((timestamp, value))
    return contributions


reducer = ReducerService()
