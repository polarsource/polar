from datetime import date
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from pytest_mock import MockerFixture
from redis.exceptions import RedisError

from polar.kit.time_queries import TimeInterval
from polar.metrics.cache import (
    METRICS_CACHE_TTL_SECONDS,
    build_cache_key,
    get_cached_metrics,
    set_cached_metrics,
)
from polar.metrics.metrics import METRICS
from polar.metrics.schemas import MetricsResponse
from polar.redis import Redis


def _empty_metrics_response() -> MetricsResponse:
    return MetricsResponse.model_validate(
        {
            "periods": [],
            "totals": {m.slug: 0 for m in METRICS},
            "metrics": {m.slug: m for m in METRICS},
        }
    )


class TestBuildCacheKey:
    def test_prefix_and_hash_shape(self) -> None:
        key = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[uuid4()],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )

        assert key.startswith("metrics:response:v1:")
        assert len(key.split(":")[-1]) == 64

    def test_identical_params_produce_identical_key(self) -> None:
        org_id = uuid4()
        key_a = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[org_id],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )
        key_b = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[org_id],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )

        assert key_a == key_b

    def test_different_org_ids_produce_different_key(self) -> None:
        key_a = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[uuid4()],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )
        key_b = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[uuid4()],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )

        assert key_a != key_b

    def test_different_date_produces_different_key(self) -> None:
        org_id = uuid4()
        key_a = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[org_id],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )
        key_b = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 2, 29),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[org_id],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )

        assert key_a != key_b

    def test_metric_order_is_normalized(self) -> None:
        org_id = uuid4()
        key_a = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[org_id],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=["orders", "revenue"],
        )
        key_b = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[org_id],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=["revenue", "orders"],
        )

        assert key_a == key_b

    def test_product_id_order_is_normalized(self) -> None:
        org_id = uuid4()
        id_a = uuid4()
        id_b = uuid4()
        key_a = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[org_id],
            product_ids=[id_a, id_b],
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )
        key_b = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[org_id],
            product_ids=[id_b, id_a],
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )

        assert key_a == key_b

    def test_org_ids_order_is_normalized(self) -> None:
        id_a = uuid4()
        id_b = uuid4()
        key_a = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[id_a, id_b],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )
        key_b = build_cache_key(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            organization_ids=[id_b, id_a],
            product_ids=None,
            customer_ids=None,
            external_customer_ids=None,
            billing_type=None,
            metrics=None,
        )

        assert key_a == key_b


@pytest.mark.asyncio
class TestGetSetCache:
    async def test_roundtrip(self, redis: Redis) -> None:
        response = _empty_metrics_response()
        key = "metrics:response:v1:test-roundtrip"

        assert await get_cached_metrics(redis, key) is None

        await set_cached_metrics(redis, key, response)
        cached = await get_cached_metrics(redis, key)

        assert cached is not None
        assert cached.model_dump_json() == response.model_dump_json()

        ttl = await redis.ttl(key)
        assert 0 < ttl <= METRICS_CACHE_TTL_SECONDS

    async def test_get_failure_returns_none(
        self, mocker: MockerFixture, redis: Redis
    ) -> None:
        mocker.patch.object(redis, "get", side_effect=RedisError("boom"))
        assert await get_cached_metrics(redis, "some-key") is None

    async def test_set_failure_is_swallowed(
        self, mocker: MockerFixture, redis: Redis
    ) -> None:
        mocker.patch.object(redis, "set", side_effect=RedisError("boom"))
        await set_cached_metrics(redis, "some-key", _empty_metrics_response())
