import hashlib
import json
from collections.abc import Sequence
from datetime import date
from uuid import UUID
from zoneinfo import ZoneInfo

import structlog
from redis.exceptions import RedisError

from polar.kit.time_queries import TimeInterval
from polar.logging import Logger
from polar.models.product import ProductBillingType
from polar.redis import Redis

from .schemas import MetricsResponse

log: Logger = structlog.get_logger()

METRICS_CACHE_TTL_SECONDS = 60
_CACHE_KEY_PREFIX = "metrics:response:v1"


def _sorted_uuid_strs(values: Sequence[UUID] | None) -> list[str] | None:
    if values is None:
        return None
    return sorted(str(v) for v in values)


def _sorted_strs(values: Sequence[str] | None) -> list[str] | None:
    if values is None:
        return None
    return sorted(values)


def _sorted_billing_types(
    values: Sequence[ProductBillingType] | None,
) -> list[str] | None:
    if values is None:
        return None
    return sorted(v.value for v in values)


def build_cache_key(
    *,
    start_date: date,
    end_date: date,
    timezone: ZoneInfo,
    interval: TimeInterval,
    organization_ids: Sequence[UUID],
    product_ids: Sequence[UUID] | None,
    customer_ids: Sequence[UUID] | None,
    external_customer_ids: Sequence[str] | None,
    billing_type: Sequence[ProductBillingType] | None,
    metrics: Sequence[str] | None,
) -> str:
    payload = {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "timezone": timezone.key,
        "interval": interval.value,
        "organization_ids": sorted(str(v) for v in organization_ids),
        "product_ids": _sorted_uuid_strs(product_ids),
        "customer_ids": _sorted_uuid_strs(customer_ids),
        "external_customer_ids": _sorted_strs(external_customer_ids),
        "billing_type": _sorted_billing_types(billing_type),
        "metrics": _sorted_strs(metrics),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"{_CACHE_KEY_PREFIX}:{digest}"


async def get_cached_metrics(redis: Redis, key: str) -> MetricsResponse | None:
    try:
        cached = await redis.get(key)
    except RedisError as exc:
        log.warning("metrics.cache.get_failed", error=str(exc))
        return None
    if cached is None:
        return None
    try:
        return MetricsResponse.model_validate_json(cached)
    except ValueError as exc:
        log.warning("metrics.cache.deserialize_failed", error=str(exc))
        return None


async def set_cached_metrics(redis: Redis, key: str, response: MetricsResponse) -> None:
    try:
        await redis.set(key, response.model_dump_json(), ex=METRICS_CACHE_TTL_SECONDS)
    except RedisError as exc:
        log.warning("metrics.cache.set_failed", error=str(exc))
