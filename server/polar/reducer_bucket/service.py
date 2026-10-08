import hashlib
import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import structlog
from redis.exceptions import RedisError

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.models import Event, Reducer
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer.repository import ReducerRepository

log: Logger = structlog.get_logger()

REDUCER_BUCKET_SIZE = timedelta(minutes=5)
REDUCER_BUCKET_TTL = timedelta(days=1)


def get_reducer_bucket_start(timestamp: datetime) -> datetime:
    size = int(REDUCER_BUCKET_SIZE.total_seconds())
    epoch = int(timestamp.timestamp())
    return datetime.fromtimestamp(epoch - epoch % size, tz=UTC)


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
        active_bucket_start = get_reducer_bucket_start(utc_now())
        active_events: list[Event] = []
        outdated_events: list[Event] = []
        for event in events:
            if get_reducer_bucket_start(event.timestamp) == active_bucket_start:
                active_events.append(event)
            else:
                outdated_events.append(event)

        if outdated_events:
            self.rollup_outdated(organization_id, outdated_events, active_bucket_start)
        if active_events:
            await self.rollup_active(
                session, redis, organization_id, active_events, active_bucket_start
            )

    async def rollup_active(
        self,
        session: AsyncSession,
        redis: Redis,
        organization_id: uuid.UUID,
        events: Sequence[Event],
        bucket_start: datetime,
    ) -> None:
        reducer_repository = ReducerRepository.from_session(session)
        reducers = await reducer_repository.get_all_active_by_organization(
            organization_id
        )

        # (reducer, customer_id, external_customer_id) -> the values events add
        buckets: dict[tuple[Reducer, uuid.UUID | None, str | None], list[float]] = (
            defaultdict(list)
        )
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
                bucket_id = (reducer, event.customer_id, event.external_customer_id)
                buckets[bucket_id].append(value)

        ttl = int(REDUCER_BUCKET_TTL.total_seconds())
        try:
            async with redis.pipeline(transaction=False) as pipe:
                for bucket_id, values in buckets.items():
                    reducer, customer_id, external_customer_id = bucket_id
                    key = get_reducer_bucket_key(
                        reducer.id, bucket_start, customer_id, external_customer_id
                    )
                    match reducer.aggregation.func:
                        case AggregationFunction.cnt:
                            await pipe.zincrby(key, len(values), "count")
                        case AggregationFunction.sum:
                            await pipe.zincrby(key, sum(values), "sum")
                        case AggregationFunction.avg:
                            await pipe.zincrby(key, len(values), "count")
                            await pipe.zincrby(key, sum(values), "sum")
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
            bucket_start=bucket_start.isoformat(),
            bucket_count=len(buckets),
            event_count=len(events),
        )

    def rollup_outdated(
        self,
        organization_id: uuid.UUID,
        events: Sequence[Event],
        active_bucket_start: datetime,
    ) -> None:
        log.info(
            "Not touching non-active reducer buckets for outdated events",
            organization_id=organization_id,
            event_count=len(events),
            oldest_timestamp=min(e.timestamp for e in events).isoformat(),
            active_bucket_start=active_bucket_start.isoformat(),
        )


reducer_bucket = ReducerBucketService()
