import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import structlog
from redis.exceptions import RedisError

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.meter.aggregation import (
    PropertyAggregation,
    UniqueAggregation,
)
from polar.models import Event, Reducer, ReducerBucket
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
        # Sorted, so concurrent requests take the bucket locks in the same order.
        for bucket_id in sorted(
            contributions,
            key=lambda b: redis_store.get_reducer_bucket_key(b[0].id, b[1], b[2], b[3]),
        ):
            reducer, bucket_start, customer_id, external_customer_id = bucket_id
            # Shared with sync, which recomputes the bucket from its events.
            await repository.lock_buckets(
                reducer, bucket_start, customer_id, external_customer_id
            )
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
            count, total, minimum, maximum = await repository.aggregate_events(
                reducer, start, end, customer_id, external_customer_id
            )
            if count == 0:
                continue
            statistics = {"count": count, "sum": total, "min": minimum, "max": maximum}
            previous = await repository.get_latest(
                reducer, start, customer_id, external_customer_id
            )
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
