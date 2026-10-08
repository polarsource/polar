import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest
from pytest_mock import MockerFixture

from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.models import Event, Organization
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer_bucket.service import (
    REDUCER_BUCKET_SIZE,
    get_reducer_bucket_key,
    get_reducer_bucket_start,
)
from polar.reducer_bucket.service import reducer_bucket as reducer_bucket_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_meter,
    create_reducer,
)

BUCKET_START = datetime(2026, 10, 7, 12, 5, tzinfo=UTC)
NEXT_BUCKET_START = datetime(2026, 10, 7, 12, 10, tzinfo=UTC)


def build_event(
    organization: Organization,
    *,
    timestamp: datetime = BUCKET_START,
    customer_id: uuid.UUID | None = None,
    external_customer_id: str | None = "external",
    metadata: dict[str, Any] | None = None,
) -> Event:
    return Event(
        name=METER_TEST_EVENT,
        timestamp=timestamp,
        organization_id=organization.id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        user_metadata=metadata or {},
    )


class TestGetReducerBucketStart:
    @pytest.mark.parametrize(
        ("timestamp", "expected"),
        [
            (BUCKET_START, BUCKET_START),
            (datetime(2026, 10, 7, 12, 9, 59, 999999, tzinfo=UTC), BUCKET_START),
            (NEXT_BUCKET_START, NEXT_BUCKET_START),
        ],
    )
    def test_floors_to_bucket(self, timestamp: datetime, expected: datetime) -> None:
        assert get_reducer_bucket_start(timestamp) == expected


class TestGetReducerBucketKey:
    def test_distinguishes_customer_identities(self) -> None:
        reducer_id = uuid.uuid4()
        customer_id = uuid.uuid4()

        keys = {
            get_reducer_bucket_key(reducer_id, BUCKET_START, customer_id, "external"),
            get_reducer_bucket_key(reducer_id, BUCKET_START, customer_id, None),
            get_reducer_bucket_key(reducer_id, BUCKET_START, None, ""),
            get_reducer_bucket_key(reducer_id, BUCKET_START, None, None),
        }

        assert len(keys) == 4

    def test_hashes_external_customer_id(self) -> None:
        key = get_reducer_bucket_key(
            uuid.uuid4(), BUCKET_START, None, "jane@example.com"
        )

        assert "jane@example.com" not in key


@pytest.mark.asyncio
class TestRollup:
    async def test_keeps_current_and_previous_bucket(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
    ) -> None:
        meter = await create_meter(save_fixture, organization=organization)
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        mocker.patch(
            "polar.reducer_bucket.service.utc_now",
            return_value=BUCKET_START + timedelta(minutes=1),
        )
        bucket_starts = [
            BUCKET_START,
            BUCKET_START - REDUCER_BUCKET_SIZE,
            BUCKET_START - 2 * REDUCER_BUCKET_SIZE,
        ]

        await reducer_bucket_service.rollup(
            session,
            redis,
            organization.id,
            [build_event(organization, timestamp=start) for start in bucket_starts],
        )

        current, previous, outdated = (
            get_reducer_bucket_key(reducer.id, start, None, "external")
            for start in bucket_starts
        )
        assert cast(bytes | None, await redis.get(current)) == b"1"
        assert cast(bytes | None, await redis.get(previous)) == b"1"
        assert await redis.exists(outdated) == 0


@pytest.mark.asyncio
class TestRollupActive:
    @pytest.mark.parametrize(
        ("aggregation", "read", "expected"),
        [
            (CountAggregation(), lambda redis, key: redis.get(key), b"6"),
            (
                PropertyAggregation(func=AggregationFunction.sum, property="tokens"),
                lambda redis, key: redis.get(key),
                b"17",
            ),
            (
                PropertyAggregation(func=AggregationFunction.avg, property="tokens"),
                lambda redis, key: redis.hmget(key, ["count", "sum"]),
                [b"6", b"17"],
            ),
            (
                PropertyAggregation(func=AggregationFunction.min, property="tokens"),
                lambda redis, key: redis.zscore(key, "min"),
                1.0,
            ),
            (
                PropertyAggregation(func=AggregationFunction.max, property="tokens"),
                lambda redis, key: redis.zscore(key, "max"),
                5.0,
            ),
        ],
        ids=["count", "sum", "avg", "min", "max"],
    )
    async def test_accumulates_across_calls(
        self,
        aggregation: Aggregation,
        read: Callable[[Redis, str], Awaitable[Any]],
        expected: Any,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, aggregation=aggregation
        )
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )

        for batch in ((1, 2, 3), (5, 4, 2)):
            events = [
                build_event(organization, metadata={"tokens": tokens})
                for tokens in batch
            ]
            await reducer_bucket_service.rollup_active(
                session, redis, organization.id, events
            )

        key = get_reducer_bucket_key(reducer.id, BUCKET_START, None, "external")
        assert await read(redis, key) == expected

    async def test_ignores_unique(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            aggregation=UniqueAggregation(property="user_id"),
        )
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )

        await reducer_bucket_service.rollup_active(
            session,
            redis,
            organization.id,
            [build_event(organization, metadata={"user_id": "a"})],
        )

        key = get_reducer_bucket_key(reducer.id, BUCKET_START, None, "external")
        assert await redis.exists(key) == 0

    async def test_sets_ttl_once(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
    ) -> None:
        meter = await create_meter(save_fixture, organization=organization)
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        key = get_reducer_bucket_key(reducer.id, BUCKET_START, None, "external")

        await reducer_bucket_service.rollup_active(
            session, redis, organization.id, [build_event(organization)]
        )
        await redis.expire(key, 10)
        await reducer_bucket_service.rollup_active(
            session, redis, organization.id, [build_event(organization)]
        )

        assert 0 < await redis.ttl(key) <= 10
