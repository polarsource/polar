import math
import uuid
from collections import defaultdict
from collections.abc import Mapping, Sequence
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
from polar.models import Event, Reducer
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
        reducers = await ReducerRepository.from_session(
            session
        ).get_all_active_by_organization(organization_id)
        if all(
            isinstance(reducer.aggregation, UniqueAggregation) for reducer in reducers
        ):
            return

        now = utc_now()
        oldest_active_bucket_start = get_oldest_active_bucket_start(now)
        buckets = _get_values_by_bucket(reducers, events)
        active_buckets = {
            bucket_id: values
            for bucket_id, values in buckets.items()
            if bucket_id[1] >= oldest_active_bucket_start
        }
        if active_buckets:
            # Roll up active events into buckets in Redis
            await self.add_active(redis, organization_id, active_buckets, len(events))

        for reducer, bucket_start, customer_id, external_customer_id in buckets:
            if isinstance(reducer.aggregation, UniqueAggregation):
                continue
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

    async def rollup_active(
        self,
        redis: Redis,
        organization_id: uuid.UUID,
        reducers: Sequence[Reducer],
        events: Sequence[Event],
    ) -> None:
        await self.add_active(
            redis, organization_id, _get_values_by_bucket(reducers, events), len(events)
        )

    async def add_active(
        self,
        redis: Redis,
        organization_id: uuid.UUID,
        buckets: Mapping[BucketId, Sequence[float]],
        event_count: int,
    ) -> None:
        try:
            await add_to_buckets(redis, buckets)
        except RedisError:
            log.exception(
                "Failed to update active reducer buckets in Redis",
                organization_id=organization_id,
                bucket_count=len(buckets),
                event_count=event_count,
            )
            return

        log.info(
            "Active reducer buckets updated in Redis",
            organization_id=organization_id,
            bucket_count=len(buckets),
            event_count=event_count,
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
        if reducer is None or isinstance(reducer.aggregation, UniqueAggregation):
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
        bucket = {
            "organization_id": reducer.organization_id,
            "reducer_id": reducer.id,
            "customer_id": customer_id,
            "external_customer_id": external_customer_id,
            "bucket_start": bucket_start,
            **statistics,
            "generation": 1 if previous is None else previous.generation + 1,
        }
        await repository.insert_buckets([bucket])
        if previous is None:
            await self.compare_with_redis(redis, reducer, bucket_start, [bucket])

    async def compare_with_redis(
        self,
        redis: Redis,
        reducer: Reducer,
        bucket_start: datetime,
        buckets: Sequence[dict[str, Any]],
    ) -> None:
        aggregation = reducer.aggregation.func
        try:
            results = await get_bucket_values(
                redis,
                reducer,
                bucket_start,
                [
                    (bucket["customer_id"], bucket["external_customer_id"])
                    for bucket in buckets
                ],
            )
        except RedisError:
            log.exception(
                "Failed to read reducer buckets from Redis for comparison",
                organization_id=reducer.organization_id,
                reducer_id=reducer.id,
                bucket_start=bucket_start.isoformat(),
            )
            return

        matching = mismatching = missing = 0
        for bucket, redis_values in zip(buckets, results, strict=True):
            match aggregation:
                case AggregationFunction.cnt:
                    postgres_values: list[float | None] = [bucket["count"]]
                case AggregationFunction.sum:
                    postgres_values = [bucket["sum"]]
                case AggregationFunction.avg:
                    postgres_values = [bucket["count"], bucket["sum"]]
                case AggregationFunction.min:
                    postgres_values = [bucket["min"]]
                case AggregationFunction.max:
                    postgres_values = [bucket["max"]]
            if all(value is None for value in redis_values):
                missing += 1
            elif _are_close(postgres_values, redis_values):
                matching += 1
            else:
                mismatching += 1
                log.warning(
                    "Reducer bucket differs from Redis",
                    organization_id=reducer.organization_id,
                    reducer_id=reducer.id,
                    aggregation=aggregation,
                    bucket_start=bucket_start.isoformat(),
                    key=get_reducer_bucket_key(
                        reducer.id,
                        bucket_start,
                        bucket["customer_id"],
                        bucket["external_customer_id"],
                    ),
                    postgres=postgres_values,
                    redis=redis_values,
                )

        log.info(
            "Reducer buckets compared with Redis",
            organization_id=reducer.organization_id,
            reducer_id=reducer.id,
            aggregation=aggregation,
            bucket_start=bucket_start.isoformat(),
            matching=matching,
            mismatching=mismatching,
            missing_in_redis=missing,
        )


def _get_values_by_bucket(
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
