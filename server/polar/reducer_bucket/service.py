import uuid
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import logfire
import structlog
from redis.exceptions import RedisError

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.meter.aggregation import (
    AggregationFunction,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.models import Customer, Event, Reducer, ReducerBucket
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer.repository import ReducerRepository
from polar.worker import enqueue_job

from . import redis_store
from .repository import ReducerBucketRepository

log: Logger = structlog.get_logger()

REDUCER_BUCKET_SIZE = timedelta(minutes=5)

type Contributions = dict[redis_store.BucketId, list[tuple[datetime, Decimal]]]


def get_reducer_bucket_start(timestamp: datetime) -> datetime:
    size = int(REDUCER_BUCKET_SIZE.total_seconds())
    epoch = int(timestamp.timestamp())
    return datetime.fromtimestamp(epoch - epoch % size, tz=UTC)


class ReducerBucketService:
    async def rollup(
        self,
        session: AsyncSession,
        redis: Redis,
        organization_id: uuid.UUID,
        events: Sequence[Event],
    ) -> None:
        reducers = [
            reducer
            for reducer in await ReducerRepository.from_session(
                session
            ).get_all_active_by_organization(organization_id)
            if not isinstance(reducer.aggregation, UniqueAggregation)
        ]
        if not reducers:
            return

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
            await self.add_to_closed_buckets(session, contributions_to_closed_buckets)

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

    async def add_to_closed_buckets(
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

    async def sync(
        self,
        session: AsyncSession,
        reducer_id: uuid.UUID,
        bucket_start: datetime,
        customer_id: uuid.UUID | None,
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
        await self._sync_bucket(
            repository, reducer, bucket_start, customer_id, external_customer_id
        )

    async def seal(
        self,
        session: AsyncSession,
        reducers: Sequence[Reducer],
        customer: Customer,
        *,
        billable_from: datetime,
        cutoff: datetime,
    ) -> dict[uuid.UUID, Decimal]:
        """Seals the customer's unsealed usage ending in (billable_from, cutoff] and
        returns its quantity per reducer."""
        quantities: dict[uuid.UUID, Decimal] = {}
        if billable_from >= cutoff:
            return quantities
        repository = ReducerBucketRepository.from_session(session)
        identities: list[tuple[uuid.UUID | None, str | None]] = [(customer.id, None)]
        if customer.external_id is not None:
            identities += [
                (None, customer.external_id),
                (customer.id, customer.external_id),
            ]

        await self._lock_buckets(
            repository,
            [
                (reducer, bucket_start, customer_id, external_customer_id)
                for reducer in reducers
                for bucket_start in {
                    get_reducer_bucket_start(billable_from),
                    get_reducer_bucket_start(cutoff),
                }
                for customer_id, external_customer_id in identities
            ],
        )

        for reducer in sorted(reducers, key=lambda reducer: str(reducer.id)):
            for customer_id, external_customer_id in identities:
                with logfire.span(
                    "Split reducer buckets",
                    reducer_id=str(reducer.id),
                    customer_id=str(customer.id),
                    bucket_customer_id=customer_id is not None,
                    bucket_external_customer_id=external_customer_id is not None,
                    billable_from=billable_from,
                    cutoff=cutoff,
                ) as span:
                    first_start, first_end = await self._get_interval_containing(
                        repository,
                        reducer,
                        customer_id,
                        external_customer_id,
                        billable_from,
                    )
                    # The earliest bucket has a start which is different from
                    # billable_from, so we need to split it.
                    split_billable_from = False
                    if first_start != billable_from:
                        split_billable_from = await self._split(
                            repository,
                            reducer,
                            customer_id,
                            external_customer_id,
                            (first_start, first_end),
                            split_at=billable_from,
                        )
                    last_start, last_end = await self._get_interval_containing(
                        repository, reducer, customer_id, external_customer_id, cutoff
                    )
                    # The last bucket in the series has an ending which is
                    # different from cutoff, so we need to split it.
                    split_cutoff = False
                    if last_start != cutoff:
                        split_cutoff = await self._split(
                            repository,
                            reducer,
                            customer_id,
                            external_customer_id,
                            (last_start, last_end),
                            split_at=cutoff,
                        )
                    span.set_attribute(
                        "first_interval",
                        [first_start.isoformat(), first_end.isoformat()],
                    )
                    span.set_attribute(
                        "last_interval", [last_start.isoformat(), last_end.isoformat()]
                    )
                    span.set_attribute("split_billable_from", split_billable_from)
                    span.set_attribute("split_cutoff", split_cutoff)
            with logfire.span(
                "Seal reducer buckets",
                reducer_id=str(reducer.id),
                customer_id=str(customer.id),
                billable_from=billable_from,
                cutoff=cutoff,
            ) as span:
                # Seal all buckets in [billable_from, cutoff) interval.
                sealed = await repository.seal(
                    reducer,
                    identities,
                    start=billable_from,
                    end=cutoff,
                    sealed_at=utc_now(),
                )
                quantity = _get_quantity(reducer.aggregation.func, sealed)
                span.set_attribute("sealed_buckets", len(sealed))
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
        customer_id: uuid.UUID | None,
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

    async def _sync_bucket(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: uuid.UUID | None,
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
                await repository.update(previous, update_dict=statistics)
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
                ),
                flush=True,
            )

    async def _get_interval_containing(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        customer_id: uuid.UUID | None,
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
        customer_id: uuid.UUID | None,
        external_customer_id: str | None,
        interval: tuple[datetime, datetime],
        *,
        split_at: datetime,
    ) -> bool:
        """Makes `split_at` a bucket boundary, so a seal can include the usage on
        one side of it only: `interval`, which contains it, becomes
        [interval_start, split_at) and [split_at, interval_end)."""
        interval_start, interval_end = interval
        bucket = await repository.get_latest_for_update(
            reducer, interval_start, customer_id, external_customer_id
        )
        if bucket is None:
            return False  # No usage in the interval.
        # An earlier seal billed past `split_at`. Billed rows can't change.
        if bucket.sealed_at is not None:
            log.warning(
                "Skipping split of a sealed reducer bucket",
                reducer_id=reducer.id,
                bucket_start=interval_start.isoformat(),
                split_at=split_at.isoformat(),
            )
            return False
        # Same, but late events arrived after that seal and opened a new generation.
        # Splitting it would leave its generations covering different intervals.
        if bucket.generation > 1:
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
        await repository.update(bucket, update_dict={"bucket_end": split_at, **before})
        await repository.create(
            ReducerBucket(
                organization_id=reducer.organization_id,
                reducer=reducer,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                bucket_start=split_at,
                bucket_end=interval_end,
                **after,
            ),
            flush=True,
        )
        return True


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
    for event in events:
        for reducer in reducers:
            if not reducer.filter.matches(event):
                continue
            aggregation = reducer.aggregation
            value = Decimal(1)
            if isinstance(aggregation, PropertyAggregation):
                property_value = aggregation.get_value(event)
                if property_value is None:
                    continue
                value = Decimal(str(property_value))
            bucket_id = (
                reducer,
                get_reducer_bucket_start(event.timestamp),
                event.customer_id,
                event.external_customer_id,
            )
            contributions[bucket_id].append((event.timestamp, value))
    return contributions


reducer_bucket = ReducerBucketService()
