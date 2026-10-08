import uuid
from datetime import UTC, datetime
from typing import Any

import pytest

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
    customer_id: uuid.UUID | None = None,
    external_customer_id: str | None = "external",
    metadata: dict[str, Any] | None = None,
) -> Event:
    return Event(
        name=METER_TEST_EVENT,
        timestamp=BUCKET_START,
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
class TestRollupActive:
    @pytest.mark.parametrize(
        ("aggregation", "expected"),
        [
            (CountAggregation(), [6, None, None, None]),
            (
                PropertyAggregation(func=AggregationFunction.sum, property="tokens"),
                [None, 17, None, None],
            ),
            (
                PropertyAggregation(func=AggregationFunction.avg, property="tokens"),
                [6, 17, None, None],
            ),
            (
                PropertyAggregation(func=AggregationFunction.min, property="tokens"),
                [None, None, 1, None],
            ),
            (
                PropertyAggregation(func=AggregationFunction.max, property="tokens"),
                [None, None, None, 5],
            ),
        ],
        ids=["count", "sum", "avg", "min", "max"],
    )
    async def test_accumulates_across_calls(
        self,
        aggregation: Aggregation,
        expected: list[float | None],
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
                session, redis, organization.id, events, BUCKET_START
            )

        key = get_reducer_bucket_key(reducer.id, BUCKET_START, None, "external")
        statistics = ["count", "sum", "min", "max"]
        assert await redis.zmscore(key, statistics) == expected

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
            BUCKET_START,
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
            session, redis, organization.id, [build_event(organization)], BUCKET_START
        )
        await redis.expire(key, 10)
        await reducer_bucket_service.rollup_active(
            session, redis, organization.id, [build_event(organization)], BUCKET_START
        )

        assert 0 < await redis.ttl(key) <= 10
