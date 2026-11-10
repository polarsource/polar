import itertools
import random
import typing
import uuid
from collections.abc import Sequence

import pytest
from pytest_codspeed import BenchmarkFixture

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.event.repository import EventRepository
from polar.event.schemas import EventCreateExternalCustomer, EventsIngest
from polar.event.service import event as event_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.models.event import EventSource
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


# Events that name a parent Polar never receives keep waiting for it. Resolving the parents of a new
# batch should only look at the events waiting for that batch.
@pytest.mark.parametrize("size", [1, 100])
def test_resolve_pending_parents_next_to_1000_orphans(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    organization: Organization,
    size: int,
) -> None:
    repository = EventRepository.from_session(session)

    def events(
        prefix: str, count: int, pending_parent_external_id: str | None = None
    ) -> list[dict[str, typing.Any]]:
        rows: list[dict[str, typing.Any]] = []
        for index in range(count):
            event_id = uuid.uuid4()
            rows.append(
                {
                    "id": event_id,
                    "name": METER_TEST_EVENT,
                    "source": EventSource.user,
                    "organization_id": organization.id,
                    "external_id": f"{prefix}-{index}",
                    "pending_parent_external_id": pending_parent_external_id,
                    "root_id": None if pending_parent_external_id else event_id,
                }
            )
        return rows

    async def seed() -> Sequence[uuid.UUID]:
        for chunk in range(10):
            await repository.insert_batch(events(f"resolved-{chunk}", 1_000))
        await repository.insert_batch(events("orphan", 1_000, "missing"))
        batch_ids, _ = await repository.insert_batch(events("batch", size))
        return batch_ids

    batch_ids = run(seed())
    analyze(run, session)
    assert run(repository.resolve_pending_parents(batch_ids)) == []
    benchmark(lambda: run(repository.resolve_pending_parents(batch_ids)))
