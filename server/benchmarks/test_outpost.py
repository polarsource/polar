import json
import typing
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from pytest_codspeed import BenchmarkFixture

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import (
    Event,
    Organization,
    Reducer,
    ReducerBucket,
)
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.outpost.schemas import (
    Changes,
    Confirmation,
    ExternalCustomerConfirmRequest,
    ExternalCustomerMeterUsageIdentity,
    Snapshot,
)
from polar.outpost.service import SYNCED_LOOKBACK
from polar.outpost.service import outpost as outpost_service
from polar.outpost.stream import Cursor, get_changes_key
from polar.redis import Redis
from polar.reducer.service import REDUCER_BUCKET_SIZE, get_reducer_bucket_start
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_customer,
    create_meter,
    create_reducer,
)

from .conftest import Run, analyze

pytestmark = pytest.mark.benchmark


async def seed_pending(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    bucket_start: datetime,
) -> Reducer:
    meter = await create_meter(save_fixture, organization=organization)
    reducer = await create_reducer(
        save_fixture, organization=organization, meters=[meter]
    )
    await create_customer(
        save_fixture, organization=organization, external_id="customer-0"
    )
    session.add(
        ReducerBucket(
            organization=organization,
            reducer=reducer,
            external_customer_id="customer-0",
            bucket_start=bucket_start,
            bucket_end=bucket_start + REDUCER_BUCKET_SIZE,
            count=1000,
            sum=Decimal(1000),
            min=Decimal(1),
            max=Decimal(1),
            synced_at=utc_now(),
        )
    )
    # Ten customers' worth of events in the bucket; the ids asked are one customer's.
    session.add_all(
        Event(
            name=METER_TEST_EVENT,
            timestamp=bucket_start + timedelta(milliseconds=index),
            ingested_at=bucket_start + timedelta(milliseconds=index),
            organization_id=organization.id,
            external_customer_id=f"customer-{index % 10}",
            external_id=f"event-{index}",
            source=EventSource.user,
        )
        for index in range(10_000)
    )
    await session.flush()
    return reducer


@pytest.mark.parametrize("ids", [1, 100, 1000])
def test_confirm(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    ids: int,
) -> None:
    bucket_start = get_reducer_bucket_start(utc_now()) - REDUCER_BUCKET_SIZE
    reducer = run(seed_pending(session, save_fixture, organization, bucket_start))
    payload = ExternalCustomerConfirmRequest(
        reducer_id=reducer.id,
        external_customer_id="customer-0",
        bucket_start=bucket_start,
        ids=[f"event-{index * 10}" for index in range(ids)],
    )

    def confirm() -> Confirmation:
        return run(outpost_service.confirm(session, organization, payload))

    confirmation = confirm()
    assert len(confirmation.ids) == ids
    assert confirmation.snapshot.customer_exists
    analyze(run, session)
    benchmark(confirm)


# Each customer's buckets since its latest reset, after a long period of sealed ones.
async def seed_customer_buckets(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    kind: ReducerKind,
) -> Reducer:
    current = get_reducer_bucket_start(utc_now())
    meter = await create_meter(save_fixture, organization=organization)
    reducer = await create_reducer(
        save_fixture, organization=organization, meters=[meter], kind=kind
    )
    # Ten customers' buckets, so the query has to select one of them.
    for index in range(10):
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email=f"customer-{index}@example.com",
            external_id=f"customer-{index}",
        )
        session.add_all(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                customer=customer,
                bucket_start=current - (slot + 1) * REDUCER_BUCKET_SIZE,
                bucket_end=current - slot * REDUCER_BUCKET_SIZE,
                count=1,
                sum=Decimal(1),
                min=Decimal(1),
                max=Decimal(1),
                sealed_at=None if slot < 100 else current,
            )
            for slot in range(1100)
        )
    await session.flush()
    return reducer


@pytest.mark.parametrize("kind", [ReducerKind.usage, ReducerKind.credit])
def test_request_meter_usage(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    kind: ReducerKind,
) -> None:
    reducer = run(seed_customer_buckets(session, save_fixture, organization, kind))
    payloads = [
        ExternalCustomerMeterUsageIdentity(
            reducer_id=reducer.id, external_customer_id="customer-0"
        )
    ]

    def request() -> list[Snapshot]:
        return run(
            outpost_service.get_requested_meter_usage(session, organization, payloads)
        )

    snapshots = request()
    assert len(snapshots) == 3
    assert all(snapshot.customer_exists for snapshot in snapshots)
    analyze(run, session)
    benchmark(request)


# An organization with many meters: the customers' buckets on each meter's reducer.
async def seed_reducers(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    reducers: int,
    customers: int = 10,
) -> list[Reducer]:
    current = get_reducer_bucket_start(utc_now())
    seeded_customers = [
        await create_customer(
            save_fixture,
            organization=organization,
            email=f"customer-{index}@example.com",
            external_id=f"customer-{index}",
        )
        for index in range(customers)
    ]
    seeded = []
    for _ in range(reducers):
        meter = await create_meter(
            save_fixture, organization=organization, id=uuid.uuid4()
        )
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        session.add_all(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                customer=customer,
                bucket_start=current - (slot + 1) * REDUCER_BUCKET_SIZE,
                bucket_end=current - slot * REDUCER_BUCKET_SIZE,
                count=1,
                sum=Decimal(1),
                min=Decimal(1),
                max=Decimal(1),
                sealed_at=None if slot < 100 else current,
            )
            for customer in seeded_customers
            for slot in range(110)
        )
        seeded.append(reducer)
    await session.flush()
    return seeded


# A cold customer's first read asks for every reducer of the organization at once.
@pytest.mark.parametrize("reducers", [1, 10, 50])
def test_request_meter_usage_of_every_reducer(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    reducers: int,
) -> None:
    seeded = run(seed_reducers(session, save_fixture, organization, reducers))
    payloads = [
        ExternalCustomerMeterUsageIdentity(
            reducer_id=reducer.id, external_customer_id="customer-0"
        )
        for reducer in seeded
    ]

    def request() -> list[Snapshot]:
        return run(
            outpost_service.get_requested_meter_usage(session, organization, payloads)
        )

    snapshots = request()
    assert len(snapshots) == 3 * reducers
    # One identity per reducer holds the customer's usage.
    assert sum(1 for snapshot in snapshots if snapshot.count) == reducers
    analyze(run, session)
    benchmark(request)


# A cold start asks for many customers of one reducer at once, up to a full batch.
@pytest.mark.parametrize("customers", [1, 100, 500])
def test_request_meter_usage_of_many_customers(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    customers: int,
) -> None:
    [reducer] = run(
        seed_reducers(session, save_fixture, organization, 1, customers=customers)
    )
    payloads = [
        ExternalCustomerMeterUsageIdentity(
            reducer_id=reducer.id, external_customer_id=f"customer-{index}"
        )
        for index in range(customers)
    ]

    def request() -> list[Snapshot]:
        return run(
            outpost_service.get_requested_meter_usage(session, organization, payloads)
        )

    snapshots = request()
    assert len(snapshots) == 3 * customers
    assert sum(1 for snapshot in snapshots if snapshot.count) == customers
    analyze(run, session)
    benchmark(request)


# One pull: a page of changes, one per customer, each read from the database.
@pytest.mark.parametrize("identities", [1, 100, 1000])
def test_get_changes(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
    identities: int,
) -> None:
    # Synced and older than the lookback: each snapshot reads it as Polar's.
    bucket_start = (
        get_reducer_bucket_start(utc_now()) - SYNCED_LOOKBACK - REDUCER_BUCKET_SIZE
    )

    async def seed() -> Cursor:
        meter = await create_meter(save_fixture, organization=organization)
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        for index in range(identities):
            await create_customer(
                save_fixture,
                organization=organization,
                email=f"customer-{index}@example.com",
                external_id=f"customer-{index}",
            )
        session.add_all(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                external_customer_id=f"customer-{index}",
                bucket_start=bucket_start,
                bucket_end=bucket_start + REDUCER_BUCKET_SIZE,
                count=1,
                sum=Decimal(1),
                min=Decimal(1),
                max=Decimal(1),
                synced_at=utc_now(),
            )
            for index in range(identities)
        )
        await session.flush()
        async with redis.pipeline() as pipeline:
            for index in range(identities):
                pipeline.xadd(
                    get_changes_key(organization.id),
                    {
                        "event": json.dumps(
                            {
                                "type": "reducer_bucket",
                                "reducer_id": str(reducer.id),
                                "customer_id": None,
                                "external_customer_id": f"customer-{index}",
                            }
                        )
                    },
                )
            entry_ids = await pipeline.execute()
        first = Cursor.parse(entry_ids[0])
        return Cursor(first.milliseconds - 1, 0)

    after = run(seed())

    def pull() -> Changes:
        return run(
            outpost_service.get_changes(session, redis, organization, after, 1000)
        )

    changes = pull()
    assert not changes.has_more
    assert [change.count for change in changes.changes] == [1] * identities
    analyze(run, session)
    benchmark(pull)
