import hashlib
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
from polar.models import Event, Reducer
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer.repository import ReducerRepository
from polar.worker import enqueue_job

from .repository import ReducerBucketRepository

log: Logger = structlog.get_logger()

REDUCER_BUCKET_SIZE = timedelta(minutes=5)
REDUCER_BUCKET_TTL = timedelta(days=1)
REDUCER_BUCKET_SYNC_LOOKBACK = timedelta(minutes=10)
REDUCER_BUCKET_CATCH_UP_LOOKBACK = timedelta(hours=3)
REDUCER_BUCKET_SYNC_MARGIN = timedelta(minutes=1)


def get_reducer_bucket_start(timestamp: datetime) -> datetime:
    size = int(REDUCER_BUCKET_SIZE.total_seconds())
    epoch = int(timestamp.timestamp())
    return datetime.fromtimestamp(epoch - epoch % size, tz=UTC)


def get_oldest_active_bucket_start(now: datetime) -> datetime:
    """Start of T-1, the older of the two active bucket starts: T and T-1."""
    return get_reducer_bucket_start(now) - REDUCER_BUCKET_SIZE


def get_reducer_bucket_key(
    reducer_id: uuid.UUID,
    bucket_start: datetime,
    customer_id: uuid.UUID | None,
    external_customer_id: str | None,
) -> str:
    key = (
        f"reducer_bucket:{reducer_id}:{int(bucket_start.timestamp())}"
        f":{customer_id or '-'}"
    )
    if external_customer_id is not None:
        key += f":{hashlib.sha256(external_customer_id.encode()).hexdigest()}"
    return key


class ReducerBucketService:
    async def rollup(
        self,
        session: AsyncSession,
        redis: Redis,
        organization_id: uuid.UUID,
        events: Sequence[Event],
    ) -> None:
        # Older events are synced into Postgres by the sync cron.
        oldest_active_bucket_start = get_oldest_active_bucket_start(utc_now())
        active_events = [
            event
            for event in events
            if get_reducer_bucket_start(event.timestamp) >= oldest_active_bucket_start
        ]
        if active_events:
            await self.rollup_active(session, redis, organization_id, active_events)

    async def rollup_active(
        self,
        session: AsyncSession,
        redis: Redis,
        organization_id: uuid.UUID,
        events: Sequence[Event],
    ) -> None:
        reducer_repository = ReducerRepository.from_session(session)
        reducers = await reducer_repository.get_all_active_by_organization(
            organization_id
        )

        # (reducer, bucket_start, customer_id, external_customer_id) -> the values
        # events add
        buckets: dict[
            tuple[Reducer, datetime, uuid.UUID | None, str | None], list[float]
        ] = defaultdict(list)
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

        ttl = int(REDUCER_BUCKET_TTL.total_seconds())
        try:
            async with redis.pipeline(transaction=False) as pipe:
                for bucket_id, values in buckets.items():
                    reducer, bucket_start, customer_id, external_customer_id = bucket_id
                    key = get_reducer_bucket_key(
                        reducer.id, bucket_start, customer_id, external_customer_id
                    )
                    match reducer.aggregation.func:
                        case AggregationFunction.cnt:
                            await pipe.incrby(key, len(values))
                        case AggregationFunction.sum:
                            await pipe.incrbyfloat(key, sum(values))
                        case AggregationFunction.avg:
                            await pipe.hincrby(key, "count", len(values))
                            await pipe.hincrbyfloat(key, "sum", sum(values))
                        case AggregationFunction.min:
                            await pipe.zadd(key, {"min": min(values)}, lt=True)
                        case AggregationFunction.max:
                            await pipe.zadd(key, {"max": max(values)}, gt=True)
                        case AggregationFunction.unique:
                            log.info(
                                "Ignoring reducer bucket of unique aggregation",
                                reducer_id=reducer.id,
                                bucket_start=bucket_start.isoformat(),
                                event_count=len(values),
                            )
                            continue
                    await pipe.expire(key, ttl, nx=True)
                await pipe.execute()
        except RedisError:
            log.exception(
                "Failed to update active reducer buckets in Redis",
                organization_id=organization_id,
                bucket_count=len(buckets),
                event_count=len(events),
            )
            return

        log.info(
            "Active reducer buckets updated in Redis",
            organization_id=organization_id,
            bucket_count=len(buckets),
            event_count=len(events),
        )

    async def schedule_syncs(self, session: AsyncSession, lookback: timedelta) -> None:
        """Enqueues syncing the buckets starting before T, with events ingested
        within `lookback`, that were never written or got events since."""
        now = utc_now()
        repository = ReducerBucketRepository.from_session(session)
        bucket_starts_by_organization: dict[uuid.UUID, list[str]] = defaultdict(list)
        for organization_id, bucket_start in await repository.get_windows_to_sync(
            bucket_size=REDUCER_BUCKET_SIZE,
            ingested_since=now - lookback,
            before=get_reducer_bucket_start(now),
            write_margin=REDUCER_BUCKET_SYNC_MARGIN,
            # A commit can land up to the margin after a write: keep re-checking
            # for as long again.
            recently_written_since=now - 2 * REDUCER_BUCKET_SYNC_MARGIN,
        ):
            bucket_starts_by_organization[organization_id].append(
                bucket_start.isoformat()
            )
        for organization_id, bucket_starts in bucket_starts_by_organization.items():
            enqueue_job(
                "reducer_bucket.sync_organization", organization_id, bucket_starts
            )

    async def sync_organization(
        self,
        session: AsyncSession,
        redis: Redis,
        organization_id: uuid.UUID,
        bucket_starts: Sequence[datetime],
    ) -> None:
        repository = ReducerBucketRepository.from_session(session)
        reducer_repository = ReducerRepository.from_session(session)
        reducers = [
            reducer
            for reducer in await reducer_repository.get_all_active_by_organization(
                organization_id
            )
            if not isinstance(reducer.aggregation, UniqueAggregation)
        ]
        # Sorted, so overlapping jobs take the locks in the same order.
        for bucket_start in sorted(bucket_starts):
            await repository.lock_window(organization_id, bucket_start)
            for reducer in reducers:
                await self.sync_buckets(session, redis, reducer, bucket_start)

    async def sync_buckets(
        self,
        session: AsyncSession,
        redis: Redis,
        reducer: Reducer,
        bucket_start: datetime,
    ) -> None:
        repository = ReducerBucketRepository.from_session(session)
        latest = {
            (bucket.customer_id, bucket.external_customer_id): bucket
            for bucket in await repository.get_latest_by_reducer_and_bucket(
                reducer, bucket_start
            )
        }
        buckets: list[dict[str, Any]] = []
        first_written: list[dict[str, Any]] = []
        for (
            customer_id,
            external_customer_id,
            count,
            total,
            minimum,
            maximum,
        ) in await repository.aggregate_events(
            reducer, bucket_start, bucket_start + REDUCER_BUCKET_SIZE
        ):
            statistics = {
                "count": count,
                "sum": total,
                "min": minimum,
                "max": maximum,
            }
            previous = latest.get((customer_id, external_customer_id))
            if previous is not None:
                if _are_close(
                    (count, total, minimum, maximum),
                    (
                        previous.count,
                        float(previous.sum),
                        _to_float(previous.min),
                        _to_float(previous.max),
                    ),
                ):
                    continue
                # Sealed buckets were billed: changes go to a new generation.
                if previous.sealed_at is None:
                    await repository.update(previous, update_dict=statistics)
                    continue
            bucket = {
                "organization_id": reducer.organization_id,
                "reducer_id": reducer.id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "bucket_start": bucket_start,
                **statistics,
                "generation": 0 if previous is None else previous.generation + 1,
            }
            buckets.append(bucket)
            if previous is None:
                first_written.append(bucket)
        await repository.insert_buckets(buckets)
        if first_written:
            await self.compare_with_redis(redis, reducer, bucket_start, first_written)

    async def compare_with_redis(
        self,
        redis: Redis,
        reducer: Reducer,
        bucket_start: datetime,
        buckets: Sequence[dict[str, Any]],
    ) -> None:
        aggregation = reducer.aggregation.func
        keys = [
            get_reducer_bucket_key(
                reducer.id,
                bucket_start,
                bucket["customer_id"],
                bucket["external_customer_id"],
            )
            for bucket in buckets
        ]
        try:
            async with redis.pipeline(transaction=False) as pipe:
                for key in keys:
                    match aggregation:
                        case AggregationFunction.cnt | AggregationFunction.sum:
                            await pipe.get(key)
                        case AggregationFunction.avg:
                            await pipe.hmget(key, ["count", "sum"])
                        case AggregationFunction.min:
                            await pipe.zscore(key, "min")
                        case AggregationFunction.max:
                            await pipe.zscore(key, "max")
                results = await pipe.execute()
        except RedisError:
            log.exception(
                "Failed to read reducer buckets from Redis for comparison",
                organization_id=reducer.organization_id,
                reducer_id=reducer.id,
                bucket_start=bucket_start.isoformat(),
            )
            return

        matching = mismatching = missing = 0
        for key, bucket, result in zip(keys, buckets, results, strict=True):
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
            redis_values = [
                _to_float(value)
                for value in (result if isinstance(result, list) else [result])
            ]
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
                    key=key,
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
