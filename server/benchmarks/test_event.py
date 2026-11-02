import itertools
import random
import typing

import pytest
from pytest_codspeed import BenchmarkFixture

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.event.schemas import EventCreateExternalCustomer, EventsIngest
from polar.event.service import event as event_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.redis import Redis
from polar.reducer.service import REDUCER_BUCKET_SIZE, get_reducer_bucket_start
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import METER_TEST_EVENT, create_meter, create_reducer

from .conftest import Run, analyze

pytestmark = pytest.mark.benchmark


def test_ingest_100_events(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    async def seed() -> None:
        meter = await create_meter(save_fixture, organization=organization)
        await create_reducer(save_fixture, organization=organization, meters=[meter])

    run(seed())
    auth_subject = AuthSubject(organization, {Scope.events_write}, None)
    ingest = EventsIngest(
        events=[
            EventCreateExternalCustomer(
                name=METER_TEST_EVENT,
                external_customer_id=f"customer-{index % 10}",
            )
            for index in range(100)
        ]
    )

    def ingest_batch() -> int:
        response = run(event_service.ingest(session, auth_subject, ingest, redis=redis))
        return response.inserted

    assert ingest_batch() == 100
    analyze(run, session)
    benchmark(ingest_batch)


# Production batches change size from one request to the next
def test_ingest_varying_batches(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    async def seed() -> None:
        meter = await create_meter(save_fixture, organization=organization)
        await create_reducer(save_fixture, organization=organization, meters=[meter])

    run(seed())
    auth_subject = AuthSubject(organization, {Scope.events_write}, None)
    sizes = itertools.cycle(random.Random(0).sample(range(20, 220), 200))

    def ingest_batch() -> int:
        size = next(sizes)
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name=METER_TEST_EVENT,
                    external_customer_id=f"customer-{index % 10}",
                )
                for index in range(size)
            ]
        )
        response = run(event_service.ingest(session, auth_subject, ingest, redis=redis))
        return response.inserted

    assert 20 <= ingest_batch() < 220
    analyze(run, session)
    benchmark(ingest_batch)


# Late events land in closed buckets, which the reducer adds to in the database instead of Redis
@pytest.mark.parametrize("size", [10, 100, 1000])
def test_ingest_late_events(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
    size: int,
) -> None:
    async def seed() -> None:
        meter = await create_meter(save_fixture, organization=organization)
        await create_reducer(save_fixture, organization=organization, meters=[meter])

    run(seed())
    auth_subject = AuthSubject(organization, {Scope.events_write}, None)
    current_bucket_start = get_reducer_bucket_start(utc_now())
    ingest = EventsIngest(
        events=[
            EventCreateExternalCustomer(
                name=METER_TEST_EVENT,
                external_customer_id=f"customer-{index % 10}",
                timestamp=current_bucket_start - (index % 3 + 1) * REDUCER_BUCKET_SIZE,
            )
            for index in range(size)
        ]
    )

    def ingest_batch() -> int:
        response = run(event_service.ingest(session, auth_subject, ingest, redis=redis))
        return response.inserted

    assert ingest_batch() == size
    benchmark(ingest_batch)
