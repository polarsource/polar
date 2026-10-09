import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
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
from polar.models import Event, Organization, Reducer, ReducerBucket
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer_bucket.redis_store import get_reducer_bucket_key
from polar.reducer_bucket.repository import ReducerBucketRepository
from polar.reducer_bucket.service import (
    REDUCER_BUCKET_SIZE,
    get_reducer_bucket_start,
)
from polar.reducer_bucket.service import reducer_bucket as reducer_bucket_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_event,
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


@pytest.mark.anyio
class TestRollup:
    async def test_active_buckets_to_redis_and_all_synced(
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
        enqueue_job = mocker.patch("polar.reducer_bucket.service.enqueue_job")
        bucket_starts = [
            BUCKET_START,
            BUCKET_START - REDUCER_BUCKET_SIZE,
            BUCKET_START - 2 * REDUCER_BUCKET_SIZE,
        ]

        events = [build_event(organization, timestamp=start) for start in bucket_starts]

        await reducer_bucket_service.rollup(session, redis, organization.id, events)

        current, previous, outdated = (
            get_reducer_bucket_key(reducer.id, start, None, "external")
            for start in bucket_starts
        )
        _, previous_start, outdated_start = bucket_starts
        assert cast(bytes | None, await redis.get(current)) == b"1"
        assert cast(bytes | None, await redis.get(previous)) == b"1"
        assert await redis.exists(outdated) == 0
        assert sorted(
            (*call.args, call.kwargs["delay"]) for call in enqueue_job.call_args_list
        ) == [
            (
                "reducer_bucket.sync",
                reducer.id,
                start.isoformat(),
                None,
                "external",
                delay,
            )
            for start, delay in sorted(
                [(previous_start, 0), (outdated_start, 0), (BUCKET_START, 240_000)]
            )
        ]

    async def test_skips_organizations_without_syncable_reducers(
        self,
        mocker: MockerFixture,
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
        await create_reducer(save_fixture, organization=organization, meters=[meter])
        enqueue_job = mocker.patch("polar.reducer_bucket.service.enqueue_job")

        await reducer_bucket_service.rollup(
            session, redis, organization.id, [build_event(organization)]
        )

        enqueue_job.assert_not_called()


@pytest.mark.anyio
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
                redis, organization.id, [reducer], events
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
            redis,
            organization.id,
            [reducer],
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
            redis, organization.id, [reducer], [build_event(organization)]
        )
        await redis.expire(key, 10)
        await reducer_bucket_service.rollup_active(
            redis, organization.id, [reducer], [build_event(organization)]
        )

        assert 0 < await redis.ttl(key) <= 10


BILLED_AT = datetime(2026, 10, 7, 12, 16, tzinfo=UTC)
CLOSED = datetime(2026, 10, 7, 12, 6, tzinfo=UTC)


@pytest.fixture
async def sum_reducer(save_fixture: SaveFixture, organization: Organization) -> Reducer:
    meter = await create_meter(
        save_fixture,
        id=uuid.uuid4(),
        organization=organization,
        aggregation=PropertyAggregation(
            func=AggregationFunction.sum, property="tokens"
        ),
    )
    return await create_reducer(save_fixture, organization=organization, meters=[meter])


async def create_tokens_event(
    save_fixture: SaveFixture,
    organization: Organization,
    tokens: int,
    *,
    timestamp: datetime = CLOSED,
    ingested_at: datetime | None = None,
) -> None:
    await create_event(
        save_fixture,
        organization=organization,
        timestamp=timestamp,
        ingested_at=ingested_at,
        external_customer_id="external",
        metadata={"tokens": tokens},
    )


async def get_buckets(session: AsyncSession) -> list[ReducerBucket]:
    repository = ReducerBucketRepository.from_session(session)
    return list(
        await repository.get_all(
            repository.get_base_statement().order_by(
                ReducerBucket.bucket_start, ReducerBucket.generation
            )
        )
    )


@pytest.mark.anyio
class TestSync:
    async def test_skips_inactive_reducers(
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
        meter.archived_at = BILLED_AT
        await save_fixture(meter)
        await create_tokens_event(save_fixture, organization, 3)

        await reducer_bucket_service.sync(
            session, redis, reducer.id, BUCKET_START, None, "external"
        )

        assert await get_buckets(session) == []

    async def test_writes_buckets(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        redis: Redis,
        organization: Organization,
    ) -> None:
        for tokens in (3, 4):
            await create_tokens_event(save_fixture, organization, tokens)
        await create_event(
            save_fixture,
            organization=organization,
            source=EventSource.system,
            timestamp=CLOSED,
            external_customer_id="external",
            metadata={"tokens": 5},
        )
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=CLOSED,
            external_customer_id="other",
            metadata={"tokens": 6},
        )

        await reducer_bucket_service.sync(
            session, redis, sum_reducer.id, BUCKET_START, None, "external"
        )

        [bucket] = await get_buckets(session)
        assert bucket.reducer_id == sum_reducer.id
        assert bucket.bucket_start == BUCKET_START
        assert bucket.external_customer_id == "external"
        assert (bucket.count, bucket.sum, bucket.min, bucket.max) == (
            2,
            Decimal(7),
            Decimal(3),
            Decimal(4),
        )
        assert bucket.generation == 1
        assert bucket.sealed_at is None

    async def test_updates_unbilled_buckets_in_place(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        redis: Redis,
        organization: Organization,
    ) -> None:
        for tokens in (3, 4, 5):
            await create_tokens_event(save_fixture, organization, tokens)
            await reducer_bucket_service.sync(
                session, redis, sum_reducer.id, BUCKET_START, None, "external"
            )
        [bucket] = await get_buckets(session)
        modified_at = bucket.modified_at

        # Unchanged: nothing is written.
        await reducer_bucket_service.sync(
            session, redis, sum_reducer.id, BUCKET_START, None, "external"
        )

        [bucket] = await get_buckets(session)
        assert (bucket.generation, bucket.count, bucket.sum) == (1, 3, Decimal(12))
        assert bucket.modified_at == modified_at is not None
        assert bucket.sealed_at is None

    async def test_events_after_billing_go_to_next_generation(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        redis: Redis,
        organization: Organization,
    ) -> None:
        await create_tokens_event(save_fixture, organization, 3, ingested_at=CLOSED)
        await reducer_bucket_service.sync(
            session, redis, sum_reducer.id, BUCKET_START, None, "external"
        )
        [billed] = await get_buckets(session)
        billed.sealed_at = BILLED_AT
        await save_fixture(billed)

        for tokens in (4, 5):
            await create_tokens_event(
                save_fixture,
                organization,
                tokens,
                ingested_at=BILLED_AT + timedelta(minutes=1),
            )
            await reducer_bucket_service.sync(
                session, redis, sum_reducer.id, BUCKET_START, None, "external"
            )

        first, second = await get_buckets(session)
        assert (first.generation, first.count, first.sum) == (1, 1, Decimal(3))
        assert first.sealed_at == BILLED_AT
        assert (second.generation, second.count, second.sum) == (2, 2, Decimal(9))
        assert (second.min, second.max) == (Decimal(4), Decimal(5))
        assert second.sealed_at is None

    @pytest.mark.parametrize(
        ("redis_tokens", "matching", "mismatching"), [((3, 4), 1, 0), ((3,), 0, 1)]
    )
    async def test_compares_with_redis(
        self,
        redis_tokens: tuple[int, ...],
        matching: int,
        mismatching: int,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        sum_reducer: Reducer,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
    ) -> None:
        for tokens in (3, 4):
            await create_tokens_event(save_fixture, organization, tokens)
        await reducer_bucket_service.rollup_active(
            redis,
            organization.id,
            [sum_reducer],
            [
                build_event(organization, metadata={"tokens": tokens})
                for tokens in redis_tokens
            ],
        )
        log = mocker.patch("polar.reducer_bucket.service.log")

        await reducer_bucket_service.sync(
            session, redis, sum_reducer.id, BUCKET_START, None, "external"
        )

        log.info.assert_called_once()
        assert log.info.call_args.kwargs["matching"] == matching
        assert log.info.call_args.kwargs["mismatching"] == mismatching
        assert log.info.call_args.kwargs["missing_in_redis"] == 0
        assert log.warning.call_count == mismatching
