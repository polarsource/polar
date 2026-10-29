import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, cast
from unittest.mock import call

import pytest
from logfire.testing import CaptureLogfire
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.event.system import SystemEvent
from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.models import (
    Customer,
    CustomerMeter,
    Event,
    Meter,
    MeterReducer,
    Order,
    Organization,
    Reducer,
    ReducerBucket,
    StagedEvent,
)
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer.bucket_repository import ReducerBucketRepository
from polar.reducer.redis_store import get_reducer_bucket_key
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import (
    REDUCER_BUCKET_SIZE,
    get_reducer_bucket_start,
)
from polar.reducer.service import reducer as reducer_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_customer,
    create_event,
    create_meter,
    create_order,
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
            "polar.reducer.service.utc_now",
            return_value=BUCKET_START + timedelta(minutes=1),
        )
        mocker.patch("polar.reducer.service.enqueue_job")

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
        enqueue_job = mocker.patch("polar.reducer.service.enqueue_job")
        previous_start = BUCKET_START - REDUCER_BUCKET_SIZE
        outdated_start = BUCKET_START - 2 * REDUCER_BUCKET_SIZE
        events = [
            build_event(organization, timestamp=start)
            for start in (BUCKET_START, previous_start, outdated_start)
        ]

        await reducer_service.rollup(session, redis, organization.id, events)

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
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        redis: Redis,
        organization: Organization,
    ) -> None:
        enqueue_outpost_event = mocker.patch(
            "polar.reducer.service.enqueue_outpost_event"
        )
        previous_start = BUCKET_START - REDUCER_BUCKET_SIZE
        for batch in ((0.1, 0.2), (0.3,)):
            await reducer_service.rollup(
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
        assert (bucket.generation, bucket.count, bucket.sum) == (1, 3, Decimal("0.6"))
        assert (bucket.min, bucket.max) == (Decimal("0.1"), Decimal("0.3"))
        assert bucket.synced_at is None
        enqueue_outpost_event.assert_called_with(
            organization.id,
            {
                "type": "reducer_bucket",
                "reducer_id": sum_reducer.id,
                "customer_id": None,
                "external_customer_id": "external",
            },
        )
        assert enqueue_outpost_event.call_count == 2

    async def test_adds_float_values_to_open_bucket(
        self,
        session: AsyncSession,
        sum_reducer: Reducer,
        redis: Redis,
        organization: Organization,
    ) -> None:
        previous_start = BUCKET_START - REDUCER_BUCKET_SIZE
        for tokens in (1.5, 2.5):
            await reducer_service.rollup(
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

        [bucket] = await get_buckets(session)
        await session.refresh(bucket)
        assert (bucket.count, bucket.sum) == (2, Decimal(4))

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
            await reducer_service.rollup(
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
        enqueue_job = mocker.patch("polar.reducer.service.enqueue_job")

        await reducer_service.rollup(
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
                b"18",
            ),
            (
                PropertyAggregation(func=AggregationFunction.avg, property="tokens"),
                lambda redis, key: redis.hmget(key, ["count", "sum"]),
                [b"6", b"18"],
            ),
            (
                PropertyAggregation(func=AggregationFunction.min, property="tokens"),
                lambda redis, key: redis.zscore(key, "min"),
                1.5,
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

        for batch in ((1.5, 2, 3), (5, 4.5, 2)):
            events = [
                build_event(organization, metadata={"tokens": tokens})
                for tokens in batch
            ]
            await reducer_service.rollup(session, redis, organization.id, events)

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

        await reducer_service.rollup(
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

        await reducer_service.rollup(
            session, redis, organization.id, [build_event(organization)]
        )
        await redis.expire(key, 10)
        await reducer_service.rollup(
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
class TestSyncBucket:
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

        await reducer_service.sync_bucket(
            session, reducer.id, BUCKET_START, None, "external"
        )

        assert await get_buckets(session) == []

    async def test_writes_buckets(
        self,
        mocker: MockerFixture,
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

        enqueue_outpost_event = mocker.patch(
            "polar.reducer.service.enqueue_outpost_event"
        )

        await reducer_service.sync_bucket(
            session, sum_reducer.id, BUCKET_START, None, "external"
        )

        enqueue_outpost_event.assert_called_once_with(
            organization.id,
            {
                "type": "reducer_bucket",
                "reducer_id": sum_reducer.id,
                "customer_id": None,
                "external_customer_id": "external",
            },
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
        assert bucket.synced_at is not None

    async def test_counts_events_waiting_in_staged_events(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        organization: Organization,
    ) -> None:
        mocker.patch("polar.reducer.service.enqueue_outpost_event")
        await create_tokens_event(save_fixture, organization, 3)
        for external_customer_id, tokens in (("external", 4), ("other", 5)):
            await save_fixture(
                StagedEvent(
                    name=METER_TEST_EVENT,
                    source=EventSource.user,
                    timestamp=CLOSED,
                    organization_id=organization.id,
                    external_customer_id=external_customer_id,
                    user_metadata={"tokens": tokens},
                )
            )

        await reducer_service.sync_bucket(
            session, sum_reducer.id, BUCKET_START, None, "external"
        )

        [bucket] = await get_buckets(session)
        assert (bucket.count, bucket.sum, bucket.min, bucket.max) == (
            2,
            Decimal(7),
            Decimal(3),
            Decimal(4),
        )

    async def test_marks_closed_bucket_contributions_synced(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        organization: Organization,
    ) -> None:
        await create_tokens_event(save_fixture, organization, 3)
        await save_fixture(
            ReducerBucket(
                organization=organization,
                reducer=sum_reducer,
                external_customer_id="external",
                bucket_start=BUCKET_START,
                bucket_end=BUCKET_START + REDUCER_BUCKET_SIZE,
                count=1,
                sum=Decimal(3),
            )
        )

        await reducer_service.sync_bucket(
            session, sum_reducer.id, BUCKET_START, None, "external"
        )

        [bucket] = await get_buckets(session)
        assert bucket.synced_at is not None

    async def test_updates_unbilled_buckets_in_place(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        sum_reducer: Reducer,
        redis: Redis,
        organization: Organization,
    ) -> None:
        for tokens in (3, 4, 5):
            await create_tokens_event(save_fixture, organization, tokens)
            await reducer_service.sync_bucket(
                session, sum_reducer.id, BUCKET_START, None, "external"
            )
        mocker.patch("polar.reducer.service.utc_now", return_value=BILLED_AT)

        # Unchanged, but synced again.
        await reducer_service.sync_bucket(
            session, sum_reducer.id, BUCKET_START, None, "external"
        )

        [bucket] = await get_buckets(session)
        assert (bucket.generation, bucket.count, bucket.sum) == (1, 3, Decimal(12))
        assert bucket.synced_at == BILLED_AT
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
        await reducer_service.sync_bucket(
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
            await reducer_service.sync_bucket(
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
        if (bucket.customer_id, bucket.external_customer_id) == (None, "external")
    ]


@pytest.mark.anyio
class TestSealBuckets:
    @pytest.fixture(autouse=True)
    def now(self, mocker: MockerFixture) -> None:
        mocker.patch("polar.reducer.service.utc_now", return_value=BILLED_AT)
        mocker.patch("polar.reducer.service.enqueue_job")

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

        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )

        await reducer_service._seal_buckets(
            session,
            [max_reducer],
            external_customer,
            until=CUTOFF,
        )

        assert await get_intervals(session) == [
            (BUCKET_START, CUTOFF, 1, 3, Decimal(5), True),
            (CUTOFF, NEXT_BUCKET_START, 1, 1, Decimal(3), False),
        ]
        assert [
            bucket.synced_at
            for bucket in await get_buckets(session)
            if (bucket.customer_id, bucket.external_customer_id) == (None, "external")
        ] == [
            BILLED_AT,
            BILLED_AT,
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
        await reducer_service.sync_bucket(
            session, max_reducer.id, old, None, "external"
        )
        await create_tokens_event(
            save_fixture, organization, 5, ingested_at=INGESTED_AT
        )
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=CLOSED,
            external_customer_id="other",
            metadata={"tokens": 6},
        )
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "other"
        )

        await reducer_service._seal_buckets(
            session,
            [max_reducer],
            external_customer,
            until=NEXT_BUCKET_START,
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

        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )

        await reducer_service._seal_buckets(
            session,
            [max_reducer],
            external_customer,
            until=CUTOFF,
        )

        assert await get_intervals(session) == [
            (BUCKET_START, CUTOFF, 1, 1, Decimal(5), True),
            (CUTOFF, NEXT_BUCKET_START, 1, 0, None, False),
        ]

    async def test_persists_boundary_without_usage(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
    ) -> None:
        await reducer_service._seal_buckets(
            session, [max_reducer], external_customer, until=CUTOFF
        )
        await create_tokens_event(
            save_fixture,
            organization,
            5,
            timestamp=CLOSED,
            ingested_at=BILLED_AT + timedelta(minutes=1),
        )
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )

        assert await get_intervals(session) == [
            (BUCKET_START, CUTOFF, 1, 0, None, True),
            (BUCKET_START, CUTOFF, 2, 1, Decimal(5), False),
            (CUTOFF, NEXT_BUCKET_START, 1, 0, None, False),
        ]

    async def test_skips_split_of_sealed_bucket(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
    ) -> None:
        await create_tokens_event(
            save_fixture, organization, 5, timestamp=CUTOFF, ingested_at=INGESTED_AT
        )
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )
        await reducer_service._seal_buckets(
            session,
            [max_reducer],
            external_customer,
            until=NEXT_BUCKET_START,
        )

        await reducer_service._seal_buckets(
            session, [max_reducer], external_customer, until=CUTOFF
        )

        assert await get_intervals(session) == [
            (BUCKET_START, NEXT_BUCKET_START, 1, 1, Decimal(5), True),
        ]

    async def test_skips_split_of_bucket_with_sealed_generation(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
    ) -> None:
        await create_tokens_event(
            save_fixture, organization, 5, timestamp=CUTOFF, ingested_at=INGESTED_AT
        )
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )
        await reducer_service._seal_buckets(
            session,
            [max_reducer],
            external_customer,
            until=NEXT_BUCKET_START,
        )
        await create_tokens_event(
            save_fixture,
            organization,
            7,
            timestamp=CUTOFF,
            ingested_at=BILLED_AT + timedelta(minutes=1),
        )
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )

        await reducer_service._seal_buckets(
            session, [max_reducer], external_customer, until=CUTOFF
        )

        assert await get_intervals(session) == [
            (BUCKET_START, NEXT_BUCKET_START, 1, 1, Decimal(5), True),
            (BUCKET_START, NEXT_BUCKET_START, 2, 1, Decimal(7), False),
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

        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )

        for cutoff in (CUTOFF, later_cutoff):
            await reducer_service._seal_buckets(
                session,
                [max_reducer],
                external_customer,
                until=cutoff,
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
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )

        await reducer_service._seal_buckets(
            session,
            [max_reducer],
            external_customer,
            until=CUTOFF,
        )

        await reducer_service.rollup(
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
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )

        assert await get_intervals(session) == [
            (BUCKET_START, CUTOFF, 1, 1, Decimal(5), True),
            (BUCKET_START, CUTOFF, 2, 1, Decimal(2), False),
            (CUTOFF, NEXT_BUCKET_START, 1, 2, Decimal(7), False),
        ]


@pytest.fixture
async def order(save_fixture: SaveFixture, external_customer: Customer) -> Order:
    return await create_order(save_fixture, customer=external_customer)


@pytest.mark.anyio
class TestBillBuckets:
    @pytest.fixture(autouse=True)
    def now(self, mocker: MockerFixture) -> None:
        mocker.patch("polar.reducer.service.utc_now", return_value=BILLED_AT)
        mocker.patch("polar.reducer.service.enqueue_job")

    async def test_marks_sealed_buckets_billed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
        order: Order,
    ) -> None:
        old = datetime(2026, 10, 7, 11, tzinfo=UTC)
        for timestamp, tokens in ((old, 4), (CLOSED, 5), (NEXT_BUCKET_START, 6)):
            await create_tokens_event(
                save_fixture,
                organization,
                tokens,
                timestamp=timestamp,
                ingested_at=INGESTED_AT,
            )
            await reducer_service.sync_bucket(
                session,
                max_reducer.id,
                get_reducer_bucket_start(timestamp),
                None,
                "external",
            )
        await reducer_service._seal_buckets(
            session, [max_reducer], external_customer, until=NEXT_BUCKET_START
        )

        quantities = await reducer_service._bill_buckets(
            session,
            [max_reducer],
            external_customer,
            order_id=order.id,
            since=START,
            until=NEXT_BUCKET_START,
        )

        assert quantities == {max_reducer.id: Decimal(5)}
        assert [
            (bucket.bucket_start, bucket.billed_at, bucket.order_id)
            for bucket in await get_buckets(session)
        ] == [
            (old, BILLED_AT, order.id),
            (BUCKET_START, BILLED_AT, order.id),
            (NEXT_BUCKET_START, None, None),
        ]

    async def test_leaves_usage_before_since_unbilled(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
        order: Order,
    ) -> None:
        for timestamp, tokens in ((CLOSED, 5), (CUTOFF, 3)):
            await create_tokens_event(
                save_fixture,
                organization,
                tokens,
                timestamp=timestamp,
                ingested_at=INGESTED_AT,
            )
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )
        for at in (CUTOFF, NEXT_BUCKET_START):
            await reducer_service._seal_buckets(
                session, [max_reducer], external_customer, until=at
            )

        quantities = await reducer_service._bill_buckets(
            session,
            [max_reducer],
            external_customer,
            order_id=order.id,
            since=CUTOFF,
            until=NEXT_BUCKET_START,
        )

        assert quantities == {max_reducer.id: Decimal(3)}
        assert [
            bucket.order_id
            for bucket in await get_buckets(session)
            if (bucket.customer_id, bucket.external_customer_id) == (None, "external")
        ] == [
            None,
            order.id,
        ]

    async def test_bills_once(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        max_reducer: Reducer,
        external_customer: Customer,
        organization: Organization,
        order: Order,
    ) -> None:
        await create_tokens_event(
            save_fixture, organization, 5, ingested_at=INGESTED_AT
        )
        await reducer_service.sync_bucket(
            session, max_reducer.id, BUCKET_START, None, "external"
        )
        await reducer_service._seal_buckets(
            session, [max_reducer], external_customer, until=NEXT_BUCKET_START
        )

        quantities = [
            await reducer_service._bill_buckets(
                session,
                [max_reducer],
                external_customer,
                order_id=order.id,
                since=START,
                until=NEXT_BUCKET_START,
            )
            for _ in range(2)
        ]

        assert quantities == [
            {max_reducer.id: Decimal(5)},
            {max_reducer.id: Decimal(0)},
        ]

    @pytest.mark.parametrize(
        ("aggregation", "expected"),
        [
            (CountAggregation(), Decimal(2)),
            (
                PropertyAggregation(func=AggregationFunction.sum, property="tokens"),
                Decimal(6),
            ),
            (
                PropertyAggregation(func=AggregationFunction.avg, property="tokens"),
                Decimal(3),
            ),
            (
                PropertyAggregation(func=AggregationFunction.min, property="tokens"),
                Decimal(2),
            ),
            (
                PropertyAggregation(func=AggregationFunction.max, property="tokens"),
                Decimal(4),
            ),
        ],
        ids=["count", "sum", "avg", "min", "max"],
    )
    async def test_returns_billed_quantity(
        self,
        aggregation: Aggregation,
        expected: Decimal,
        save_fixture: SaveFixture,
        session: AsyncSession,
        external_customer: Customer,
        organization: Organization,
        order: Order,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, aggregation=aggregation
        )
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        for timestamp, tokens in (
            (BUCKET_START - timedelta(minutes=4), 2),
            (CLOSED, 4),
        ):
            await create_tokens_event(
                save_fixture,
                organization,
                tokens,
                timestamp=timestamp,
                ingested_at=INGESTED_AT,
            )
        for bucket_start in (BUCKET_START - REDUCER_BUCKET_SIZE, BUCKET_START):
            await reducer_service.sync_bucket(
                session, reducer.id, bucket_start, None, "external"
            )

        await reducer_service._seal_buckets(
            session, [reducer], external_customer, until=NEXT_BUCKET_START
        )

        quantities = await reducer_service._bill_buckets(
            session,
            [reducer],
            external_customer,
            order_id=order.id,
            since=START,
            until=NEXT_BUCKET_START,
        )

        assert quantities == {reducer.id: expected}
        assert len(await get_buckets(session)) == 2


@pytest.mark.anyio
class TestEnqueueSeal:
    @pytest.mark.parametrize(
        ("now", "delay"),
        [
            (CUTOFF + timedelta(minutes=5), 6 * 60 * 1000),
            (CUTOFF + timedelta(minutes=20), 0),
        ],
    )
    def test_waits_for_the_buckets(
        self,
        now: datetime,
        delay: int,
        mocker: MockerFixture,
        customer: Customer,
        meter: Meter,
    ) -> None:
        mocker.patch("polar.reducer.service.utc_now", return_value=now)
        enqueue_job = mocker.patch("polar.reducer.service.enqueue_job")

        reducer_service.enqueue_seal(customer.id, meter.id, at=CUTOFF)

        enqueue_job.assert_called_once_with(
            "reducer.seal", customer.id, meter.id, CUTOFF.isoformat(), delay=delay
        )


@pytest.mark.anyio
class TestSeal:
    async def test_seals_the_meters_usage_and_credit_reducers(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        usage = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        credit = await create_reducer(
            save_fixture,
            organization=organization,
            meters=[meter],
            kind=ReducerKind.credit,
        )
        seal = mocker.patch.object(reducer_service, "_seal_buckets")

        await reducer_service.seal(session, customer, meter.id, at=CUTOFF)

        seal.assert_called_once_with(session, [usage, credit], customer, until=CUTOFF)

    async def test_logs_failures_without_raising(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await create_reducer(save_fixture, organization=organization, meters=[meter])
        mocker.patch.object(reducer_service, "_seal_buckets", side_effect=RuntimeError)

        await reducer_service.seal(session, customer, meter.id, at=CUTOFF)

        assert await session.get(Meter, meter.id) is not None


RESET = datetime(2026, 10, 7, 11, tzinfo=UTC)


async def create_reset_event(
    save_fixture: SaveFixture, customer: Customer, meter: Meter, timestamp: datetime
) -> None:
    await create_event(
        save_fixture,
        organization=customer.organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.meter_reset,
        timestamp=timestamp,
        metadata={"meter_id": str(meter.id)},
    )


async def add_credit(
    save_fixture: SaveFixture,
    session: AsyncSession,
    customer: Customer,
    meter: Meter,
    units: int,
    timestamp: datetime,
) -> None:
    event = await create_event(
        save_fixture,
        organization=customer.organization,
        customer=customer,
        source=EventSource.system,
        name=SystemEvent.meter_credited,
        timestamp=timestamp,
        metadata={"meter_id": str(meter.id), "units": units, "rollover": False},
    )
    await reducer_service.add_credit(session, event)


@pytest.mark.anyio
class TestBill:
    async def test_seals_then_bills_the_meters_usage_and_credit_reducers(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        usage = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        credit = await create_reducer(
            save_fixture,
            organization=organization,
            meters=[meter],
            kind=ReducerKind.credit,
        )
        for timestamp in (RESET, CUTOFF):
            await create_reset_event(save_fixture, customer, meter, timestamp)
        seal = mocker.patch.object(reducer_service, "_seal_buckets")
        bill = mocker.patch.object(
            reducer_service,
            "_bill_buckets",
            side_effect=[{usage.id: Decimal(3)}, {credit.id: Decimal(2)}],
        )
        order_id = uuid.uuid4()

        quantities = await reducer_service.bill(
            session,
            customer,
            [meter.id],
            order_id=order_id,
            billable_from=START,
            cutoff=CUTOFF,
        )

        assert quantities == {meter.id: (Decimal(3), Decimal(2))}
        assert seal.call_args_list == [
            call(session, [usage], customer, since=START, until=CUTOFF),
            call(session, [credit], customer, since=RESET, until=CUTOFF),
        ]
        assert bill.call_args_list == [
            call(
                session, [usage], customer, order_id=order_id, since=START, until=CUTOFF
            ),
            call(
                session,
                [credit],
                customer,
                order_id=order_id,
                since=RESET,
                until=CUTOFF,
            ),
        ]

    async def test_bills_the_credits_since_the_latest_reset(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await reducer_service.sync_meter(session, meter)
        await create_reset_event(save_fixture, customer, meter, RESET)
        for timestamp, units in (
            (RESET - timedelta(minutes=30), 10),
            (RESET, 4),
            (CUTOFF, 6),
        ):
            await add_credit(save_fixture, session, customer, meter, units, timestamp)
        order = await create_order(save_fixture, customer=customer)

        quantities = await reducer_service.bill(
            session,
            customer,
            [meter.id],
            order_id=order.id,
            billable_from=START,
            cutoff=CUTOFF,
        )

        assert quantities == {meter.id: (Decimal(0), Decimal(4))}
        assert [
            (bucket.sum, bucket.order_id)
            for bucket in await get_buckets(session)
            if bucket.count
        ] == [(Decimal(10), None), (Decimal(4), order.id), (Decimal(6), None)]

    async def test_floors_credits_at_zero(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await reducer_service.sync_meter(session, meter)
        await add_credit(save_fixture, session, customer, meter, -5, RESET)
        order = await create_order(save_fixture, customer=customer)

        quantities = await reducer_service.bill(
            session,
            customer,
            [meter.id],
            order_id=order.id,
            billable_from=START,
            cutoff=CUTOFF,
        )

        assert quantities == {meter.id: (Decimal(0), Decimal(0))}

    async def test_splits_at_billable_from_without_a_reset(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        external_customer: Customer,
        organization: Organization,
        order: Order,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            aggregation=PropertyAggregation(
                func=AggregationFunction.max, property="tokens"
            ),
        )
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        for timestamp, tokens in ((CLOSED, 5), (CUTOFF, 3)):
            await create_tokens_event(
                save_fixture,
                organization,
                tokens,
                timestamp=timestamp,
                ingested_at=INGESTED_AT,
            )
        await reducer_service.sync_bucket(
            session, reducer.id, BUCKET_START, None, "external"
        )

        quantities = await reducer_service.bill(
            session,
            external_customer,
            [meter.id],
            order_id=order.id,
            billable_from=CUTOFF,
            cutoff=NEXT_BUCKET_START,
        )

        assert quantities == {meter.id: (Decimal(3), Decimal(0))}
        assert [
            (bucket.bucket_start, bucket.bucket_end, bucket.order_id)
            for bucket in await get_buckets(session)
            if (bucket.customer_id, bucket.external_customer_id) == (None, "external")
        ] == [
            (BUCKET_START, CUTOFF, None),
            (CUTOFF, NEXT_BUCKET_START, order.id),
        ]

    async def test_logs_failures_without_raising(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await create_reducer(save_fixture, organization=organization, meters=[meter])
        mocker.patch.object(reducer_service, "_seal_buckets", side_effect=RuntimeError)

        quantities = await reducer_service.bill(
            session,
            customer,
            [meter.id],
            order_id=uuid.uuid4(),
            billable_from=START,
            cutoff=CUTOFF,
        )

        assert quantities == {}
        assert await session.get(Meter, meter.id) is not None


SUM_TOKENS = PropertyAggregation(func=AggregationFunction.sum, property="tokens")


async def rollup_tokens(
    save_fixture: SaveFixture,
    session: AsyncSession,
    redis: Redis,
    organization: Organization,
    aggregation: Aggregation,
) -> Reducer:
    """Rolls up 2, 3 and 4 tokens into the buckets T-2, T-1 and T."""
    meter = await create_meter(
        save_fixture, organization=organization, aggregation=aggregation
    )
    reducer = await create_reducer(
        save_fixture, organization=organization, meters=[meter]
    )
    events = [
        build_event(organization, timestamp=timestamp, metadata={"tokens": tokens})
        for timestamp, tokens in (
            (BUCKET_START - 2 * REDUCER_BUCKET_SIZE, 2),
            (BUCKET_START - REDUCER_BUCKET_SIZE, 3),
            (BUCKET_START, 4),
        )
    ]
    await reducer_service.rollup(session, redis, organization.id, events)
    return reducer


@pytest.mark.anyio
class TestGetCustomerValue:
    @pytest.fixture(autouse=True)
    def now(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "polar.reducer.service.utc_now",
            return_value=BUCKET_START + timedelta(minutes=1),
        )
        mocker.patch("polar.reducer.service.enqueue_job")

    @pytest.mark.parametrize(
        ("aggregation", "expected"),
        [
            (CountAggregation(), 3),
            (SUM_TOKENS, 9),
            (PropertyAggregation(func=AggregationFunction.avg, property="tokens"), 3),
            (PropertyAggregation(func=AggregationFunction.min, property="tokens"), 2),
            (PropertyAggregation(func=AggregationFunction.max, property="tokens"), 4),
        ],
    )
    async def test_combines_postgres_and_redis(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        aggregation: Aggregation,
        expected: int,
    ) -> None:
        reducer = await rollup_tokens(
            save_fixture, session, redis, organization, aggregation
        )

        value = await reducer_service.get_customer_value(
            session, redis, reducer, uuid.uuid4(), "external"
        )

        assert value == expected

    @pytest.mark.parametrize(
        ("since", "expected"),
        [
            (BUCKET_START - 2 * REDUCER_BUCKET_SIZE, 9),
            (BUCKET_START - 2 * REDUCER_BUCKET_SIZE + timedelta(seconds=1), 7),
            (BUCKET_START - REDUCER_BUCKET_SIZE, 7),
            (BUCKET_START, 4),
            (BUCKET_START + timedelta(seconds=1), 0),
        ],
    )
    async def test_since(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        since: datetime,
        expected: int,
    ) -> None:
        reducer = await rollup_tokens(
            save_fixture, session, redis, organization, SUM_TOKENS
        )

        value = await reducer_service.get_customer_value(
            session, redis, reducer, None, "external", since=since
        )

        assert value == expected

    async def test_other_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
    ) -> None:
        reducer = await rollup_tokens(
            save_fixture, session, redis, organization, SUM_TOKENS
        )

        value = await reducer_service.get_customer_value(
            session, redis, reducer, None, "other"
        )

        assert value == 0


@pytest.fixture
async def customer_meter(
    save_fixture: SaveFixture, organization: Organization, customer: Customer
) -> CustomerMeter:
    meter = await create_meter(save_fixture, organization=organization)
    await create_reducer(save_fixture, organization=organization, meters=[meter])
    customer_meter = CustomerMeter(
        customer=customer,
        meter=meter,
        consumed_units=Decimal(5),
        credited_units=0,
        balance=Decimal(-5),
    )
    await save_fixture(customer_meter)
    return customer_meter


@pytest.mark.anyio
class TestLogCustomerMeterComparison:
    async def test_logs_values_since_latest_reset(
        self,
        capfire: CaptureLogfire,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        customer: Customer,
        customer_meter: CustomerMeter,
    ) -> None:
        reset = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            metadata={"meter_id": str(customer_meter.meter_id)},
        )
        get_customer_value = mocker.patch.object(
            reducer_service, "get_customer_value", return_value=Decimal(4)
        )

        await reducer_service.log_customer_meter_comparison(
            session, redis, customer_meter
        )

        assert get_customer_value.call_args.kwargs == {"since": reset.timestamp}
        [span] = [
            span
            for span in capfire.exporter.exported_spans
            if span.name == "Compare customer meter with reducer"
            and span.attributes is not None
            and span.attributes.get("logfire.span_type") == "span"
        ]
        assert span.attributes is not None
        assert span.attributes["legacy"] == "5"
        assert span.attributes["reducer"] == "4"
        assert span.attributes["match"] is False
        assert span.attributes["aggregation"] == "count"

    async def test_logs_unsealed_credits(
        self,
        capfire: CaptureLogfire,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        customer: Customer,
        customer_meter: CustomerMeter,
    ) -> None:
        credit = await create_reducer(
            save_fixture,
            organization=organization,
            meters=[customer_meter.meter],
            kind=ReducerKind.credit,
        )
        for bucket_start, units, sealed_at in (
            (BUCKET_START, 100, CLOSED),
            (NEXT_BUCKET_START, 7, None),
        ):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=credit,
                    customer_id=customer.id,
                    bucket_start=bucket_start,
                    bucket_end=bucket_start + REDUCER_BUCKET_SIZE,
                    count=1,
                    sum=Decimal(units),
                    sealed_at=sealed_at,
                )
            )
        mocker.patch.object(
            reducer_service, "get_customer_value", return_value=Decimal(5)
        )

        await reducer_service.log_customer_meter_comparison(
            session, redis, customer_meter
        )

        [span] = [
            span
            for span in capfire.exporter.exported_spans
            if span.name == "Compare customer meter with reducer"
            and span.attributes is not None
            and span.attributes.get("logfire.span_type") == "span"
        ]
        assert span.attributes is not None
        assert span.attributes["legacy_credited"] == "0"
        assert span.attributes["reducer_credited"] == "7"
        assert span.attributes["credited_match"] is False

    async def test_swallows_failure(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        customer_meter: CustomerMeter,
    ) -> None:
        mocker.patch.object(
            reducer_service, "get_customer_value", side_effect=RuntimeError
        )

        await reducer_service.log_customer_meter_comparison(
            session, redis, customer_meter
        )

        assert await session.get(CustomerMeter, customer_meter.id) is not None


async def get_meter_reducers(session: AsyncSession, meter: Meter) -> list[Reducer]:
    return list(
        await session.scalars(
            select(Reducer)
            .join(MeterReducer)
            .where(MeterReducer.meter_id == meter.id)
            .order_by(Reducer.kind)
        )
    )


def build_credit_event(meter_id: uuid.UUID, units: int) -> Event:
    return Event(
        name=SystemEvent.meter_credited,
        source=EventSource.system,
        user_metadata={"meter_id": str(meter_id), "units": units, "rollover": False},
    )


@pytest.mark.anyio
class TestSyncMeter:
    async def test_creates_usage_and_credit_reducers(
        self, session: AsyncSession, meter: Meter
    ) -> None:
        reducer = await reducer_service.sync_meter(session, meter)

        credit, usage = await get_meter_reducers(session, meter)
        assert reducer == usage
        assert usage.kind == ReducerKind.usage
        assert usage.filter == meter.filter
        assert usage.aggregation == meter.aggregation
        assert credit.kind == ReducerKind.credit
        assert isinstance(credit.aggregation, PropertyAggregation)
        assert credit.filter.matches(build_credit_event(meter.id, 10))
        assert credit.aggregation.get_value(build_credit_event(meter.id, 10)) == 10
        assert not credit.filter.matches(build_credit_event(uuid.uuid4(), 10))
        assert not credit.filter.matches(build_event(meter.organization))

    async def test_updates_only_the_usage_reducer(
        self, session: AsyncSession, meter: Meter
    ) -> None:
        await reducer_service.sync_meter(session, meter)
        credit_before, _ = await get_meter_reducers(session, meter)
        meter.aggregation = PropertyAggregation(
            func=AggregationFunction.sum, property="tokens"
        )

        await reducer_service.sync_meter(session, meter)

        credit, usage = await get_meter_reducers(session, meter)
        assert credit.id == credit_before.id
        assert credit.aggregation == PropertyAggregation(
            func=AggregationFunction.sum, property="units"
        )
        assert usage.aggregation == meter.aggregation


@pytest.mark.anyio
class TestSyncCredits:
    async def test_rebuilds_the_credits_since_the_latest_reset(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await reducer_service.sync_meter(session, meter)
        meter_id = str(meter.id)
        for name, metadata, timestamp in (
            (SystemEvent.meter_credited, {"units": 10}, CUTOFF - timedelta(hours=1)),
            (SystemEvent.meter_reset, {}, CUTOFF),
            (SystemEvent.meter_credited, {"units": 4}, CUTOFF),
            (SystemEvent.meter_credited, {"units": 6}, CUTOFF + timedelta(hours=1)),
        ):
            await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                source=EventSource.system,
                name=name,
                timestamp=timestamp,
                metadata={"meter_id": meter_id, "rollover": False, **metadata},
            )
        credit = await ReducerRepository.from_session(session).get_by_meter_and_kind(
            meter.id, ReducerKind.credit
        )
        assert credit is not None

        for _ in range(2):
            await reducer_service.sync_credits(session, customer, meter.id)

            count, total, _, _ = await ReducerBucketRepository.from_session(
                session
            ).get_unsealed_totals(organization.id, credit.id, [(customer.id, None)])
            assert (count, total) == (2, 10)
