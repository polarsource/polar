import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal

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

type Contributions = dict[redis_store.BucketId, list[tuple[datetime, float]]]


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
        # Sorted, so concurrent requests take the bucket locks in the same order,
        # and all taken before writing any row, so a seal can't deadlock with us.
        bucket_ids = sorted(
            contributions,
            key=lambda b: redis_store.get_reducer_bucket_key(b[0].id, b[1], b[2], b[3]),
        )
        for bucket_id in bucket_ids:
            # Shared with sync, which recomputes the bucket from its events.
            await repository.lock_buckets(*bucket_id)
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
                        "total": sum(values),
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
        await repository.lock_buckets(
            reducer, bucket_start, customer_id, external_customer_id
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
            repository, reducers, identities, start=billable_from, cutoff=cutoff
        )

        for reducer in sorted(reducers, key=lambda reducer: str(reducer.id)):
            for customer_id, external_customer_id in identities:
                for at in (billable_from, cutoff):
                    await self._split(
                        repository, reducer, at, customer_id, external_customer_id
                    )
            sealed = await repository.seal(
                reducer,
                identities,
                start=billable_from,
                end=cutoff,
                sealed_at=utc_now(),
            )
            quantities[reducer.id] = _get_quantity(reducer.aggregation.func, sealed)
        return quantities

    async def _lock_buckets(
        self,
        repository: ReducerBucketRepository,
        reducers: Sequence[Reducer],
        identities: Sequence[tuple[uuid.UUID | None, str | None]],
        *,
        start: datetime,
        cutoff: datetime,
    ) -> None:
        bucket_ids = sorted(
            (
                (reducer, bucket_start, customer_id, external_customer_id)
                for reducer in reducers
                for bucket_start in {
                    get_reducer_bucket_start(start),
                    get_reducer_bucket_start(cutoff),
                }
                for customer_id, external_customer_id in identities
            ),
            key=lambda b: redis_store.get_reducer_bucket_key(b[0].id, b[1], b[2], b[3]),
        )
        for bucket_id in bucket_ids:
            await repository.lock_buckets(*bucket_id)

    async def _get_intervals(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        bucket_start: datetime,
        customer_id: uuid.UUID | None,
        external_customer_id: str | None,
    ) -> list[tuple[datetime, datetime]]:
        """The persisted [start, end) intervals the bucket was split into."""
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

    async def _split(
        self,
        repository: ReducerBucketRepository,
        reducer: Reducer,
        at: datetime,
        customer_id: uuid.UUID | None,
        external_customer_id: str | None,
    ) -> None:
        """Splits the interval containing `at` into [start, at) and [at, end)."""
        start, end = next(
            (start, end)
            for start, end in await self._get_intervals(
                repository,
                reducer,
                get_reducer_bucket_start(at),
                customer_id,
                external_customer_id,
            )
            if start <= at < end
        )
        already_split = start == at
        if already_split:
            return

        bucket = await repository.get_latest_for_update(
            reducer, start, customer_id, external_customer_id
        )
        if bucket is None:
            return
        if bucket.sealed_at is not None or bucket.generation > 1:
            log.warning(
                "Skipping split of sealed reducer bucket",
                reducer_id=reducer.id,
                bucket_start=start.isoformat(),
                at=at.isoformat(),
            )
            return

        left = (
            await repository.aggregate_events(
                reducer, start, at, customer_id, external_customer_id
            )
        )._asdict()
        right = (
            await repository.aggregate_events(
                reducer, at, end, customer_id, external_customer_id
            )
        )._asdict()

        await repository.update(bucket, update_dict={"bucket_end": at, **left})
        await repository.create(
            ReducerBucket(
                organization_id=reducer.organization_id,
                reducer=reducer,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                bucket_start=at,
                bucket_end=end,
                **right,
            ),
            flush=True,
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
            value = 1.0
            if isinstance(aggregation, PropertyAggregation):
                property_value = aggregation.get_value(event)
                if property_value is None:
                    continue
                value = property_value
            bucket_id = (
                reducer,
                get_reducer_bucket_start(event.timestamp),
                event.customer_id,
                event.external_customer_id,
            )
            contributions[bucket_id].append((event.timestamp, value))
    return contributions


reducer_bucket = ReducerBucketService()
