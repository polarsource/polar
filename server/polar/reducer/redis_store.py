import hashlib
import uuid
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from decimal import Decimal

import structlog

from polar.logging import Logger
from polar.meter.aggregation import AggregationFunction
from polar.models import Reducer
from polar.redis import Redis

log: Logger = structlog.get_logger()

REDUCER_BUCKET_TTL = timedelta(days=1)

type BucketId = tuple[Reducer, datetime, uuid.UUID | None, str | None]


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


async def add_to_buckets(
    redis: Redis, contributions: Mapping[BucketId, Sequence[Decimal]]
) -> None:
    """Adds the values to their buckets, skipping unique aggregations."""
    ttl = int(REDUCER_BUCKET_TTL.total_seconds())
    async with redis.pipeline(transaction=False) as pipe:
        for bucket_id, values in contributions.items():
            reducer, bucket_start, customer_id, external_customer_id = bucket_id
            key = get_reducer_bucket_key(
                reducer.id, bucket_start, customer_id, external_customer_id
            )
            match reducer.aggregation.func:
                case AggregationFunction.cnt:
                    await pipe.incrby(key, len(values))
                case AggregationFunction.sum:
                    await pipe.incrbyfloat(key, float(sum(values)))
                case AggregationFunction.avg:
                    await pipe.hincrby(key, "count", len(values))
                    await pipe.hincrbyfloat(key, "sum", float(sum(values)))
                case AggregationFunction.min:
                    await pipe.zadd(key, {"min": float(min(values))}, lt=True)
                case AggregationFunction.max:
                    await pipe.zadd(key, {"max": float(max(values))}, gt=True)
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


async def get_bucket_totals(
    redis: Redis,
    reducer_id: uuid.UUID,
    func: AggregationFunction,
    bucket_starts: Sequence[datetime],
    identities: Sequence[tuple[uuid.UUID | None, str | None]],
) -> list[tuple[int, Decimal, Decimal | None, Decimal | None]]:
    """count, sum, min and max of each of the identities' buckets."""
    async with redis.pipeline(transaction=False) as pipe:
        for bucket_start in bucket_starts:
            for customer_id, external_customer_id in identities:
                key = get_reducer_bucket_key(
                    reducer_id, bucket_start, customer_id, external_customer_id
                )
                match func:
                    case AggregationFunction.cnt | AggregationFunction.sum:
                        await pipe.get(key)
                    case AggregationFunction.avg:
                        await pipe.hmget(key, ["count", "sum"])
                    case AggregationFunction.min:
                        await pipe.zscore(key, "min")
                    case AggregationFunction.max:
                        await pipe.zscore(key, "max")
        results = await pipe.execute()

    totals: list[tuple[int, Decimal, Decimal | None, Decimal | None]] = []
    for result in results:
        match func:
            case AggregationFunction.cnt:
                totals.append((int(result or 0), Decimal(0), None, None))
            case AggregationFunction.sum:
                totals.append((0, _to_decimal(result) or Decimal(0), None, None))
            case AggregationFunction.avg:
                count, total = result
                totals.append(
                    (int(count or 0), _to_decimal(total) or Decimal(0), None, None)
                )
            case AggregationFunction.min:
                totals.append((0, Decimal(0), _to_decimal(result), None))
            case AggregationFunction.max:
                totals.append((0, Decimal(0), None, _to_decimal(result)))
    return totals


def _to_decimal(value: str | bytes | float | None) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode()
    return Decimal(str(value))
