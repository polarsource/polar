import math
import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from redis.exceptions import RedisError

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.meter.aggregation import (
    AggregationFunction,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.models import Event, Reducer, ReducerBucket
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer.repository import ReducerRepository
from polar.worker import enqueue_job

from .redis_store import (
    BucketId,
    add_to_buckets,
    get_bucket_values,
    get_reducer_bucket_key,
)
from .repository import ReducerBucketRepository

log: Logger = structlog.get_logger()

REDUCER_BUCKET_SIZE = timedelta(minutes=5)


def get_reducer_bucket_start(timestamp: datetime) -> datetime:
    size = int(REDUCER_BUCKET_SIZE.total_seconds())
    epoch = int(timestamp.timestamp())
    return datetime.fromtimestamp(epoch - epoch % size, tz=UTC)


def get_oldest_active_bucket_start(now: datetime) -> datetime:
    """Start of T-1, the older of the two active bucket starts: T and T-1."""
    return get_reducer_bucket_start(now) - REDUCER_BUCKET_SIZE


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
        oldest_active_bucket_start = get_oldest_active_bucket_start(now)
        buckets = _reduce_events_to_bucket_contributions(reducers, events)
        active_buckets = {
            bucket_id: values
            for bucket_id, values in buckets.items()
            if bucket_id[1] >= oldest_active_bucket_start
        }
        if active_buckets:
            # Roll up active events into buckets in Redis
            try:
                await add_to_buckets(redis, active_buckets)
            except RedisError:
                log.exception(
                    "Failed to update active reducer buckets in Redis",
                    organization_id=organization_id,
                    bucket_count=len(active_buckets),
                    event_count=len(events),
                )
            else:
                log.info(
                    "Active reducer buckets updated in Redis",
                    organization_id=organization_id,
                    bucket_count=len(active_buckets),
                    event_count=len(events),
                )

        for reducer, bucket_start, customer_id, external_customer_id in buckets:
            # Delay syncing for the currently active bucket (T)
            delay = bucket_start + REDUCER_BUCKET_SIZE - now
            enqueue_job(
                "reducer_bucket.sync",
                reducer.id,
                bucket_start.isoformat(),
                customer_id,
                external_customer_id,
                delay=max(0, int(delay.total_seconds() * 1000)),
            )

    async def sync(
        self,
        session: AsyncSession,
        redis: Redis,
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
        count, total, minimum, maximum = await repository.aggregate_events(
            reducer,
            bucket_start,
            bucket_start + REDUCER_BUCKET_SIZE,
            customer_id,
            external_customer_id,
        )
        if count == 0:
            return
        statistics = {"count": count, "sum": total, "min": minimum, "max": maximum}
        previous = await repository.get_latest(
            reducer, bucket_start, customer_id, external_customer_id
        )
        # Sealed buckets were billed: events since go to a new generation.
        if previous is not None and previous.sealed_at is None:
            if not _are_close(
                (count, total, minimum, maximum),
                (
                    previous.count,
                    float(previous.sum),
                    _to_float(previous.min),
                    _to_float(previous.max),
                ),
            ):
                await repository.update(previous, update_dict=statistics)
            return
        bucket = await repository.create(
            ReducerBucket(
                organization_id=reducer.organization_id,
                reducer=reducer,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                bucket_start=bucket_start,
                **statistics,
                generation=1 if previous is None else previous.generation + 1,
            ),
            flush=True,
        )
        if previous is None:
            await self.compare_with_redis(redis, reducer, bucket)

    async def compare_with_redis(
        self, redis: Redis, reducer: Reducer, bucket: ReducerBucket
    ) -> None:
        aggregation = reducer.aggregation.func
        log_fields = {
            "organization_id": reducer.organization_id,
            "reducer_id": reducer.id,
            "aggregation": aggregation,
            "bucket_start": bucket.bucket_start.isoformat(),
            "key": get_reducer_bucket_key(
                reducer.id,
                bucket.bucket_start,
                bucket.customer_id,
                bucket.external_customer_id,
            ),
        }
        try:
            [redis_values] = await get_bucket_values(
                redis,
                reducer,
                bucket.bucket_start,
                [(bucket.customer_id, bucket.external_customer_id)],
            )
        except RedisError:
            log.exception(
                "Failed to read reducer bucket from Redis for comparison",
                **log_fields,
            )
            return

        match aggregation:
            case AggregationFunction.cnt:
                postgres_values: list[float | None] = [bucket.count]
            case AggregationFunction.sum:
                postgres_values = [_to_float(bucket.sum)]
            case AggregationFunction.avg:
                postgres_values = [bucket.count, _to_float(bucket.sum)]
            case AggregationFunction.min:
                postgres_values = [_to_float(bucket.min)]
            case AggregationFunction.max:
                postgres_values = [_to_float(bucket.max)]
        if all(value is None for value in redis_values):
            log.info("Reducer bucket missing in Redis", **log_fields)
        elif _are_close(postgres_values, redis_values):
            log.debug("Reducer bucket matches Redis", **log_fields)
        else:
            log.warning(
                "Reducer bucket differs from Redis",
                **log_fields,
                postgres=postgres_values,
                redis=redis_values,
            )


def _reduce_events_to_bucket_contributions(
    reducers: Sequence[Reducer], events: Sequence[Event]
) -> dict[BucketId, list[float]]:
    """The values each event adds to the buckets of the reducers it matches."""
    buckets: dict[BucketId, list[float]] = defaultdict(list)
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
            buckets[bucket_id].append(value)
    return buckets


def _are_close(values: Sequence[float | None], others: Sequence[float | None]) -> bool:
    """Equal, with floats compared with a tolerance and None only equal to None."""
    return all(
        value is None
        and other is None
        or value is not None
        and other is not None
        and math.isclose(value, other)
        for value, other in zip(values, others, strict=True)
    )


def _to_float(value: Any) -> float | None:
    return float(value) if value is not None else None


reducer_bucket = ReducerBucketService()
