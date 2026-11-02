import typing
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from pytest_codspeed import BenchmarkFixture
from sqlalchemy import func, select

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, Event, Organization, Reducer, ReducerBucket
from polar.models.event import EventSource
from polar.redis import Redis
from polar.reducer.service import (
    REDUCER_BUCKET_SIZE,
    get_reducer_bucket_start,
)
from polar.reducer.service import reducer as reducer_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_customer,
    create_meter,
    create_reducer,
)

from .conftest import Run, analyze, create_metered_reducer

pytestmark = pytest.mark.benchmark


def build_events(organization: Organization, count: int) -> list[Event]:
    now = datetime.now(UTC)
    return [
        Event(
            name=METER_TEST_EVENT,
            timestamp=now,
            organization_id=organization.id,
            external_customer_id=f"customer-{index % 10}",
            user_metadata={"tokens": index},
        )
        for index in range(count)
    ]


@pytest.mark.parametrize("reducers", [1, 10])
def test_rollup_100_events(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
    reducers: int,
) -> None:
    async def seed() -> None:
        for _ in range(reducers):
            await create_metered_reducer(session, save_fixture, organization)

    run(seed())
    events = build_events(organization, 100)
    contributed = run(reducer_service.rollup(session, redis, organization.id, events))
    assert contributed == reducers * 10
    analyze(run, session)
    benchmark(
        lambda: run(reducer_service.rollup(session, redis, organization.id, events))
    )


# One event per customer: every ingest updates one Redis bucket and enqueues one sync job per
# customer.
def test_rollup_100_customers(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    run(create_metered_reducer(session, save_fixture, organization))
    now = datetime.now(UTC)
    events = [
        Event(
            name=METER_TEST_EVENT,
            timestamp=now,
            organization_id=organization.id,
            external_customer_id=f"customer-{index}",
            user_metadata={"tokens": index},
        )
        for index in range(100)
    ]
    contributed = run(reducer_service.rollup(session, redis, organization.id, events))
    assert contributed == 100
    analyze(run, session)
    benchmark(
        lambda: run(reducer_service.rollup(session, redis, organization.id, events))
    )


# Late events: each closed bucket is locked, read and written in the database.
def test_rollup_100_events_into_closed_buckets(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    run(create_metered_reducer(session, save_fixture, organization))
    closed = get_reducer_bucket_start(utc_now()) - 2 * REDUCER_BUCKET_SIZE
    events = [
        Event(
            name=METER_TEST_EVENT,
            timestamp=closed,
            organization_id=organization.id,
            external_customer_id=f"customer-{index % 10}",
            user_metadata={"tokens": index},
        )
        for index in range(100)
    ]
    contributed = run(reducer_service.rollup(session, redis, organization.id, events))
    assert contributed == 10
    analyze(run, session)
    benchmark(
        lambda: run(reducer_service.rollup(session, redis, organization.id, events))
    )


def test_sync_bucket_1000_events(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    bucket_start = get_reducer_bucket_start(utc_now()) - REDUCER_BUCKET_SIZE
    timestamps = [bucket_start + timedelta(milliseconds=index) for index in range(1000)]

    async def seed() -> Reducer:
        meter = await create_meter(save_fixture, organization=organization)
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        session.add_all(
            Event(
                name=METER_TEST_EVENT,
                timestamp=timestamp,
                organization_id=organization.id,
                external_customer_id="customer",
                source=EventSource.user,
            )
            for timestamp in timestamps
        )
        await session.flush()
        return reducer

    reducer = run(seed())

    def sync() -> None:
        run(
            reducer_service.sync_bucket(
                session, reducer.id, bucket_start, None, "customer"
            )
        )

    sync()
    bucket = run(
        session.scalar(
            select(ReducerBucket).where(ReducerBucket.reducer_id == reducer.id)
        )
    )
    assert bucket is not None
    assert bucket.count == 1000
    analyze(run, session)
    benchmark(sync)


@pytest.mark.parametrize("buckets", [1, 12, 288])
def test_cold_usage(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    buckets: int,
) -> None:
    newest_start = get_reducer_bucket_start(utc_now()) - REDUCER_BUCKET_SIZE
    since = newest_start - (buckets - 1) * REDUCER_BUCKET_SIZE

    async def seed() -> Reducer:
        meter = await create_meter(save_fixture, organization=organization)
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        # Ten customers' worth of buckets, so the query has to select one of them.
        session.add_all(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                external_customer_id=f"customer-{customer}",
                bucket_start=since + index * REDUCER_BUCKET_SIZE,
                bucket_end=since + (index + 1) * REDUCER_BUCKET_SIZE,
                count=10,
                sum=Decimal(100),
                min=Decimal(1),
                max=Decimal(50),
                synced_at=utc_now(),
            )
            for customer in range(10)
            for index in range(buckets)
        )
        await session.flush()
        return reducer

    reducer = run(seed())

    def read() -> tuple[typing.Any, typing.Any]:
        return run(
            reducer_service.get_cold_usage(
                session, reducer, None, "customer-0", since=since
            )
        )

    cold_until, totals = read()
    assert cold_until == newest_start + REDUCER_BUCKET_SIZE
    assert totals.count == 10 * buckets
    analyze(run, session)
    benchmark(read)


# A reset after a day of usage: splits the slot it falls in and seals the day.
def test_seal_288_buckets(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    newest_start = get_reducer_bucket_start(utc_now()) - REDUCER_BUCKET_SIZE
    since = newest_start - 287 * REDUCER_BUCKET_SIZE
    at = newest_start + REDUCER_BUCKET_SIZE / 2

    async def seed() -> tuple[Customer, Reducer]:
        reducer = await create_metered_reducer(session, save_fixture, organization)
        customer = await create_customer(
            save_fixture, organization=organization, external_id="customer"
        )
        session.add_all(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                customer_id=customer.id,
                bucket_start=since + index * REDUCER_BUCKET_SIZE,
                bucket_end=since + (index + 1) * REDUCER_BUCKET_SIZE,
                count=10,
                sum=Decimal(100),
                min=Decimal(1),
                max=Decimal(50),
                synced_at=utc_now(),
            )
            for index in range(288)
        )
        # The slot the reset splits is recomputed from its events.
        session.add_all(
            Event(
                name=METER_TEST_EVENT,
                timestamp=newest_start + timedelta(seconds=index),
                organization_id=organization.id,
                customer_id=customer.id,
                source=EventSource.user,
            )
            for index in range(10)
        )
        await session.flush()
        return customer, reducer

    customer, reducer = run(seed())
    meter_id = reducer.meter_ids[0]
    savepoint: typing.Any = None

    def begin() -> None:
        nonlocal savepoint
        savepoint = run(session.begin_nested())

    def rollback() -> None:
        run(savepoint.rollback())

    def seal() -> None:
        run(reducer_service.seal(session, customer, meter_id, at=at))

    begin()
    seal()
    sealed = run(
        session.scalar(
            select(func.count())
            .select_from(ReducerBucket)
            .where(
                ReducerBucket.reducer_id == reducer.id,
                ReducerBucket.customer_id == customer.id,
                ReducerBucket.external_customer_id.is_(None),
                ReducerBucket.sealed_at.is_not(None),
            )
        )
    )
    assert sealed == 288
    rollback()
    analyze(run, session)
    benchmark.pedantic(seal, setup=begin, teardown=rollback, rounds=20)
