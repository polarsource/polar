import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, cast

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.models import Event, Organization, Reducer, ReducerBucket
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer_bucket.repository import ReducerBucketRepository
from polar.reducer_bucket.service import (
    REDUCER_BUCKET_CATCH_UP_LOOKBACK,
    REDUCER_BUCKET_SIZE,
    REDUCER_BUCKET_SYNC_LOOKBACK,
    get_reducer_bucket_key,
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


@pytest.mark.anyio
class TestRollup:
    async def test_active_buckets_to_redis_only(
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

        events = [build_event(organization, timestamp=start) for start in bucket_starts]

        await reducer_bucket_service.rollup(session, redis, organization.id, events)

        current, previous, outdated = (
            get_reducer_bucket_key(reducer.id, start, None, "external")
            for start in bucket_starts
        )
        assert cast(bytes | None, await redis.get(current)) == b"1"
        assert cast(bytes | None, await redis.get(previous)) == b"1"
        assert await redis.exists(outdated) == 0


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


# 12:16: 12:10 and 12:15 are active, 12:05 closed a minute ago.
SYNC_NOW = datetime(2026, 10, 7, 12, 16, tzinfo=UTC)
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
        ingested_at=ingested_at or timestamp,
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
class TestScheduleSyncs:
    @pytest.mark.parametrize(
        ("minute", "enqueued"),
        [(14, False), (15, True)],
        ids=["T", "T-1"],
    )
    async def test_enqueues_buckets_once_closed(
        self,
        minute: int,
        enqueued: bool,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        sum_reducer: Reducer,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # The 12:10 buckets are T until 12:15, then T-1.
        timestamp = datetime(2026, 10, 7, 12, 11, tzinfo=UTC)
        await create_tokens_event(save_fixture, organization, 3, timestamp=timestamp)
        mocker.patch(
            "polar.reducer_bucket.service.utc_now",
            return_value=datetime(2026, 10, 7, 12, minute, tzinfo=UTC),
        )
        enqueue_job = mocker.patch("polar.reducer_bucket.service.enqueue_job")

        await reducer_bucket_service.schedule_syncs(
            session, REDUCER_BUCKET_SYNC_LOOKBACK
        )

        if enqueued:
            enqueue_job.assert_called_once_with(
                "reducer_bucket.sync_organization",
                organization.id,
                [NEXT_BUCKET_START.isoformat()],
            )
        else:
            enqueue_job.assert_not_called()

    async def test_enqueues_written_buckets_with_late_events(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        sum_reducer: Reducer,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        await create_tokens_event(save_fixture, organization, 3)
        # No reducers: never enqueued.
        await create_tokens_event(save_fixture, organization_second, 3)
        enqueue_job = mocker.patch("polar.reducer_bucket.service.enqueue_job")
        with freeze_time(SYNC_NOW):
            await reducer_bucket_service.sync_organization(
                session, redis, organization.id, [BUCKET_START]
            )

        with freeze_time(SYNC_NOW + timedelta(minutes=2)):
            await reducer_bucket_service.schedule_syncs(
                session, REDUCER_BUCKET_SYNC_LOOKBACK
            )
        enqueue_job.assert_not_called()

        late = SYNC_NOW + timedelta(minutes=3)
        await create_tokens_event(save_fixture, organization, 4, ingested_at=late)
        with freeze_time(late):
            await reducer_bucket_service.schedule_syncs(
                session, REDUCER_BUCKET_SYNC_LOOKBACK
            )
        enqueue_job.assert_called_once_with(
            "reducer_bucket.sync_organization",
            organization.id,
            [BUCKET_START.isoformat()],
        )

    @pytest.mark.parametrize(
        ("minute", "enqueued"),
        [(13, True), (15, False)],
        ids=["recently_written", "written_earlier"],
    )
    async def test_rechecks_events_ingested_just_before_the_write(
        self,
        minute: int,
        enqueued: bool,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        sum_reducer: Reducer,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
    ) -> None:
        straggler = datetime(2026, 10, 7, 12, 11, 30, tzinfo=UTC)
        await create_tokens_event(save_fixture, organization, 3, ingested_at=straggler)
        enqueue_job = mocker.patch("polar.reducer_bucket.service.enqueue_job")
        with freeze_time(datetime(2026, 10, 7, 12, 12, tzinfo=UTC)):
            await reducer_bucket_service.sync_organization(
                session, redis, organization.id, [BUCKET_START]
            )

        with freeze_time(datetime(2026, 10, 7, 12, minute, tzinfo=UTC)):
            await reducer_bucket_service.schedule_syncs(
                session, REDUCER_BUCKET_SYNC_LOOKBACK
            )

        assert enqueue_job.called is enqueued

    async def test_skips_organizations_without_syncable_reducers(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        unique_meter = await create_meter(
            save_fixture,
            organization=organization,
            aggregation=UniqueAggregation(property="tokens"),
        )
        await create_reducer(
            save_fixture, organization=organization, meters=[unique_meter]
        )
        archived_meter = await create_meter(
            save_fixture, id=uuid.uuid4(), organization=organization_second
        )
        archived_meter.archived_at = SYNC_NOW
        await save_fixture(archived_meter)
        await create_reducer(
            save_fixture, organization=organization_second, meters=[archived_meter]
        )
        for org in (organization, organization_second):
            await create_tokens_event(save_fixture, org, 3)
        mocker.patch(
            "polar.reducer_bucket.service.utc_now",
            return_value=CLOSED + timedelta(minutes=6),
        )
        enqueue_job = mocker.patch("polar.reducer_bucket.service.enqueue_job")

        await reducer_bucket_service.schedule_syncs(
            session, REDUCER_BUCKET_SYNC_LOOKBACK
        )

        enqueue_job.assert_not_called()

    async def test_catch_up_lookback_enqueues_older_buckets(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        sum_reducer: Reducer,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await create_tokens_event(save_fixture, organization, 3)
        mocker.patch(
            "polar.reducer_bucket.service.utc_now",
            return_value=SYNC_NOW + timedelta(hours=1),
        )
        enqueue_job = mocker.patch("polar.reducer_bucket.service.enqueue_job")

        await reducer_bucket_service.schedule_syncs(
            session, REDUCER_BUCKET_SYNC_LOOKBACK
        )
        enqueue_job.assert_not_called()

        await reducer_bucket_service.schedule_syncs(
            session, REDUCER_BUCKET_CATCH_UP_LOOKBACK
        )
        enqueue_job.assert_called_once_with(
            "reducer_bucket.sync_organization",
            organization.id,
            [BUCKET_START.isoformat()],
        )


@pytest.mark.anyio
class TestSyncOrganization:
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

        await reducer_bucket_service.sync_organization(
            session, redis, organization.id, [BUCKET_START]
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
        assert bucket.generation == 0
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
            await reducer_bucket_service.sync_organization(
                session, redis, organization.id, [BUCKET_START]
            )
        [bucket] = await get_buckets(session)
        modified_at = bucket.modified_at

        # Unchanged: nothing is written.
        await reducer_bucket_service.sync_organization(
            session, redis, organization.id, [BUCKET_START]
        )

        [bucket] = await get_buckets(session)
        assert (bucket.generation, bucket.count, bucket.sum) == (0, 3, Decimal(12))
        assert bucket.modified_at == modified_at is not None
        assert bucket.sealed_at is None

    async def test_new_generation_once_billed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        redis: Redis,
        organization: Organization,
    ) -> None:
        await create_tokens_event(save_fixture, organization, 3)
        await reducer_bucket_service.sync_organization(
            session, redis, organization.id, [BUCKET_START]
        )
        [billed] = await get_buckets(session)
        billed.sealed_at = SYNC_NOW
        await save_fixture(billed)

        await create_tokens_event(save_fixture, organization, 4)
        await reducer_bucket_service.sync_organization(
            session, redis, organization.id, [BUCKET_START]
        )

        first, second = await get_buckets(session)
        assert (first.generation, first.count, first.sealed_at) == (0, 1, SYNC_NOW)
        assert (second.generation, second.count, second.sum) == (1, 2, Decimal(7))
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
            session,
            redis,
            organization.id,
            [
                build_event(organization, metadata={"tokens": tokens})
                for tokens in redis_tokens
            ],
        )
        log = mocker.patch("polar.reducer_bucket.service.log")

        await reducer_bucket_service.sync_organization(
            session, redis, organization.id, [BUCKET_START]
        )

        log.info.assert_called_once()
        assert log.info.call_args.kwargs["matching"] == matching
        assert log.info.call_args.kwargs["mismatching"] == mismatching
        assert log.info.call_args.kwargs["missing_in_redis"] == 0
        assert log.warning.call_count == mismatching
