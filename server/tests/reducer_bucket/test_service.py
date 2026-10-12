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
from polar.models import Customer, Event, Organization, Reducer, ReducerBucket
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
    create_customer,
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
    @pytest.fixture(autouse=True)
    def active_now(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "polar.reducer_bucket.service.utc_now",
            return_value=BUCKET_START + timedelta(minutes=1),
        )
        mocker.patch("polar.reducer_bucket.service.enqueue_job")

    async def test_routes_buckets_by_age(
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
        enqueue_job = mocker.patch("polar.reducer_bucket.service.enqueue_job")
        previous_start = BUCKET_START - REDUCER_BUCKET_SIZE
        outdated_start = BUCKET_START - 2 * REDUCER_BUCKET_SIZE
        events = [
            build_event(organization, timestamp=start)
            for start in (BUCKET_START, previous_start, outdated_start)
        ]

        await reducer_bucket_service.rollup(session, redis, organization.id, events)

        current, previous, outdated = (
            get_reducer_bucket_key(reducer.id, start, None, "external")
            for start in (BUCKET_START, previous_start, outdated_start)
        )
        assert cast(bytes | None, await redis.get(current)) == b"1"
        assert cast(bytes | None, await redis.get(previous)) == b"1"
        assert await redis.exists(outdated) == 0
        assert [
            (bucket.bucket_start, bucket.bucket_end, bucket.count, bucket.generation)
            for bucket in await get_buckets(session)
        ] == [
            (outdated_start, previous_start, 1, 1),
            (previous_start, BUCKET_START, 1, 1),
        ]
        # Only the current bucket waits for a sync, once it closes at 12:10.
        enqueue_job.assert_called_once_with(
            "reducer_bucket.sync",
            reducer.id,
            BUCKET_START.isoformat(),
            None,
            "external",
            delay=240_000,
        )

    async def test_adds_to_closed_buckets(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        redis: Redis,
        organization: Organization,
    ) -> None:
        previous_start = BUCKET_START - REDUCER_BUCKET_SIZE
        for batch in ((3, 4), (2,)):
            await reducer_bucket_service.rollup(
                session,
                redis,
                organization.id,
                [
                    build_event(
                        organization,
                        timestamp=previous_start,
                        metadata={"tokens": tokens},
                    )
                    for tokens in batch
                ],
            )

        [bucket] = await get_buckets(session)
        assert (bucket.generation, bucket.count, bucket.sum) == (1, 3, Decimal(9))
        assert (bucket.min, bucket.max) == (Decimal(2), Decimal(4))

    async def test_adds_to_next_generation_once_billed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        redis: Redis,
        organization: Organization,
    ) -> None:
        previous_start = BUCKET_START - REDUCER_BUCKET_SIZE
        for tokens in (3, 4):
            await reducer_bucket_service.rollup(
                session,
                redis,
                organization.id,
                [
                    build_event(
                        organization,
                        timestamp=previous_start,
                        metadata={"tokens": tokens},
                    )
                ],
            )
            [*_, latest] = await get_buckets(session)
            latest.sealed_at = BILLED_AT
            await save_fixture(latest)

        first, second = await get_buckets(session)
        assert (first.generation, first.sum) == (1, Decimal(3))
        assert (second.generation, second.sum) == (2, Decimal(4))

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
            await reducer_bucket_service.rollup(session, redis, organization.id, events)

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

        await reducer_bucket_service.rollup(
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

        await reducer_bucket_service.rollup(
            session, redis, organization.id, [build_event(organization)]
        )
        await redis.expire(key, 10)
        await reducer_bucket_service.rollup(
            session, redis, organization.id, [build_event(organization)]
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
            session, reducer.id, BUCKET_START, None, "external"
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
            session, sum_reducer.id, BUCKET_START, None, "external"
        )

        [bucket] = await get_buckets(session)
        assert bucket.reducer_id == sum_reducer.id
        assert bucket.bucket_start == BUCKET_START
        assert bucket.bucket_end == BUCKET_START + REDUCER_BUCKET_SIZE
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
                session, sum_reducer.id, BUCKET_START, None, "external"
            )
        [bucket] = await get_buckets(session)
        modified_at = bucket.modified_at

        # Unchanged: nothing is written.
        await reducer_bucket_service.sync(
            session, sum_reducer.id, BUCKET_START, None, "external"
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
            session, sum_reducer.id, BUCKET_START, None, "external"
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
                session, sum_reducer.id, BUCKET_START, None, "external"
            )

        first, second = await get_buckets(session)
        assert (first.generation, first.count, first.sum) == (1, 1, Decimal(3))
        assert first.sealed_at == BILLED_AT
        assert (second.generation, second.count, second.sum) == (2, 2, Decimal(9))
        assert (second.min, second.max) == (Decimal(4), Decimal(5))
        assert second.sealed_at is None


CUTOFF = datetime(2026, 10, 7, 12, 7, tzinfo=UTC)
START = datetime(2026, 10, 7, 10, tzinfo=UTC)
INGESTED_AT = BILLED_AT - timedelta(minutes=1)


@pytest.fixture
async def max_reducer(save_fixture: SaveFixture, organization: Organization) -> Reducer:
    meter = await create_meter(
        save_fixture,
        id=uuid.uuid4(),
        organization=organization,
        aggregation=PropertyAggregation(
            func=AggregationFunction.max, property="tokens"
        ),
    )
    return await create_reducer(save_fixture, organization=organization, meters=[meter])


@pytest.fixture
async def external_customer(
    save_fixture: SaveFixture, organization: Organization
) -> Customer:
    return await create_customer(
        save_fixture, organization=organization, external_id="external"
    )


async def get_intervals(
    session: AsyncSession,
) -> list[tuple[datetime, datetime, int, int, Decimal | None, bool]]:
    return [
        (
            bucket.bucket_start,
            bucket.bucket_end,
            bucket.generation,
            bucket.count,
            bucket.max,
            bucket.sealed_at is not None,
        )
        for bucket in await get_buckets(session)
    ]


@pytest.mark.anyio
class TestSeal:
    @pytest.fixture(autouse=True)
    def now(self, mocker: MockerFixture) -> None:
        mocker.patch("polar.reducer_bucket.service.utc_now", return_value=BILLED_AT)
        mocker.patch("polar.reducer_bucket.service.enqueue_job")

    async def test_splits_at_cutoff(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
    ) -> None:
        for timestamp, tokens in (
            (CLOSED, 5),
            (CLOSED, 2),
            (CUTOFF - timedelta(microseconds=1), 1),
            (CUTOFF, 3),
        ):
            await create_tokens_event(
                save_fixture,
                organization,
                tokens,
                timestamp=timestamp,
                ingested_at=INGESTED_AT,
            )

        await reducer_bucket_service.seal(
            session, [max_reducer], external_customer, start=START, cutoff=CUTOFF
        )

        assert await get_intervals(session) == [
            (BUCKET_START, CUTOFF, 1, 3, Decimal(5), True),
            (CUTOFF, NEXT_BUCKET_START, 1, 1, Decimal(3), False),
        ]

    async def test_seals_whole_buckets_up_to_a_boundary(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
    ) -> None:
        old = datetime(2026, 10, 7, 11, tzinfo=UTC)
        await create_tokens_event(
            save_fixture, organization, 4, timestamp=old, ingested_at=INGESTED_AT
        )
        await reducer_bucket_service.sync(
            session, max_reducer.id, old, None, "external"
        )
        await create_tokens_event(
            save_fixture, organization, 5, ingested_at=INGESTED_AT
        )
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=CLOSED,
            external_customer_id="other",
            metadata={"tokens": 6},
        )
        await reducer_bucket_service.sync(
            session, max_reducer.id, BUCKET_START, None, "other"
        )

        await reducer_bucket_service.seal(
            session,
            [max_reducer],
            external_customer,
            start=START,
            cutoff=NEXT_BUCKET_START,
        )

        buckets = sorted(
            await get_buckets(session),
            key=lambda bucket: (bucket.external_customer_id, bucket.bucket_start),
        )
        assert [
            (bucket.external_customer_id, bucket.bucket_start, bucket.max)
            for bucket in buckets
        ] == [
            ("external", old, Decimal(4)),
            ("external", BUCKET_START, Decimal(5)),
            ("other", BUCKET_START, Decimal(6)),
        ]
        assert [bucket.sealed_at for bucket in buckets] == [BILLED_AT, BILLED_AT, None]
        assert {bucket.bucket_end - bucket.bucket_start for bucket in buckets} == {
            REDUCER_BUCKET_SIZE
        }

    async def test_persists_empty_remainder(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
    ) -> None:
        await create_tokens_event(
            save_fixture, organization, 5, ingested_at=INGESTED_AT
        )

        await reducer_bucket_service.seal(
            session, [max_reducer], external_customer, start=START, cutoff=CUTOFF
        )

        assert await get_intervals(session) == [
            (BUCKET_START, CUTOFF, 1, 1, Decimal(5), True),
            (CUTOFF, NEXT_BUCKET_START, 1, 0, None, False),
        ]

    async def test_leaves_usage_before_start_open(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
    ) -> None:
        for timestamp, tokens in ((CLOSED, 5), (CUTOFF, 3)):
            await create_tokens_event(
                save_fixture,
                organization,
                tokens,
                timestamp=timestamp,
                ingested_at=INGESTED_AT,
            )

        await reducer_bucket_service.seal(
            session,
            [max_reducer],
            external_customer,
            start=CUTOFF,
            cutoff=NEXT_BUCKET_START,
        )

        assert await get_intervals(session) == [
            (BUCKET_START, CUTOFF, 1, 1, Decimal(5), False),
            (CUTOFF, NEXT_BUCKET_START, 1, 1, Decimal(3), True),
        ]

    async def test_splits_repeatedly(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
    ) -> None:
        later_cutoff = CUTOFF + timedelta(minutes=1)
        for timestamp, tokens in ((CLOSED, 5), (CUTOFF, 3), (later_cutoff, 4)):
            await create_tokens_event(
                save_fixture,
                organization,
                tokens,
                timestamp=timestamp,
                ingested_at=INGESTED_AT,
            )

        for cutoff in (CUTOFF, later_cutoff):
            await reducer_bucket_service.seal(
                session, [max_reducer], external_customer, start=START, cutoff=cutoff
            )

        assert await get_intervals(session) == [
            (BUCKET_START, CUTOFF, 1, 1, Decimal(5), True),
            (CUTOFF, later_cutoff, 1, 1, Decimal(3), True),
            (later_cutoff, NEXT_BUCKET_START, 1, 1, Decimal(4), False),
        ]

    async def test_routes_later_events_to_split_intervals(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
    ) -> None:
        for timestamp, tokens in ((CLOSED, 5), (CUTOFF, 3)):
            await create_tokens_event(
                save_fixture,
                organization,
                tokens,
                timestamp=timestamp,
                ingested_at=INGESTED_AT,
            )
        await reducer_bucket_service.seal(
            session, [max_reducer], external_customer, start=START, cutoff=CUTOFF
        )

        await reducer_bucket_service.rollup(
            session,
            redis,
            organization.id,
            [
                build_event(organization, timestamp=CLOSED, metadata={"tokens": 2}),
                build_event(organization, timestamp=CUTOFF, metadata={"tokens": 6}),
            ],
        )
        await create_tokens_event(
            save_fixture,
            organization,
            7,
            timestamp=CUTOFF,
            ingested_at=BILLED_AT + timedelta(minutes=1),
        )
        await reducer_bucket_service.sync(
            session, max_reducer.id, BUCKET_START, None, "external"
        )

        assert await get_intervals(session) == [
            (BUCKET_START, CUTOFF, 1, 1, Decimal(5), True),
            (BUCKET_START, CUTOFF, 2, 1, Decimal(2), False),
            (CUTOFF, NEXT_BUCKET_START, 1, 2, Decimal(7), False),
        ]
