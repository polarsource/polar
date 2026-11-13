import itertools
import random
import typing
import uuid
from collections.abc import Sequence

import httpx
import pytest
from pytest_codspeed import BenchmarkFixture
from sqlalchemy.ext.asyncio import async_sessionmaker
from starlette.types import ASGIApp, Receive, Send
from starlette.types import Scope as ASGIScope

from polar import rate_limit
from polar.app import app as polar_app
from polar.auth.middlewares import AuthSubjectMiddleware
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.event.repository import EventRepository
from polar.event.schemas import EventCreateExternalCustomer, EventsIngest
from polar.event.service import event as event_service
from polar.kit.crypto import get_token_hash
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.logfire import instrument_sqlalchemy
from polar.middlewares import TransactionalMiddleware
from polar.models import Organization, OrganizationAccessToken
from polar.models.event import EventSource
from polar.observability.http_middleware import HttpMetricsMiddleware
from polar.organization_access_token.service import TOKEN_PREFIX
from polar.redis import Redis
from polar.reducer.service import REDUCER_BUCKET_SIZE, get_reducer_bucket_start
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import METER_TEST_EVENT, create_meter, create_reducer

from .conftest import Run, analyze, create_metered_reducer

pytestmark = pytest.mark.benchmark

STAGED_EVENT_NAMES = [METER_TEST_EVENT, "benchmark.b", "benchmark.c", "benchmark.d"]
STAGED_BATCH_SIZES = [9, 26]


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


async def seed_staged_ingest(
    session: AsyncSession, save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "staged_events_ingest_enabled": True,
    }
    await save_fixture(organization)
    await create_metered_reducer(session, save_fixture, organization)


def staged_events(size: int, batch: int) -> list[dict[str, str]]:
    return [
        {
            "name": STAGED_EVENT_NAMES[index % len(STAGED_EVENT_NAMES)],
            "external_customer_id": f"customer-{index % 3}",
            "external_id": f"{batch}-{index}",
        }
        for index in range(size)
    ]


# The shape of a slow request traced on the test environment: staged ingest, four event names,
# an external ID on every event. A repeated external ID is a duplicate, so each call gets new ones.
@pytest.mark.parametrize("size", STAGED_BATCH_SIZES)
def test_ingest_staged_events(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
    size: int,
) -> None:
    run(seed_staged_ingest(session, save_fixture, organization))
    auth_subject = AuthSubject(organization, {Scope.events_write}, None)
    ingest = EventsIngest.model_validate({"events": staged_events(size, 0)})
    batches = itertools.count(1)

    def ingest_batch() -> int:
        batch = next(batches)
        timestamp = utc_now()
        for index, event in enumerate(ingest.events):
            event.external_id = f"{batch}-{index}"
            event.timestamp = timestamp
        response = run(event_service.ingest(session, auth_subject, ingest, redis=redis))
        return response.inserted

    assert ingest_batch() == size
    analyze(run, session)
    benchmark(ingest_batch)


# The same batches through the API, with the middlewares the app leaves out when testing.
@pytest.mark.parametrize("size", STAGED_BATCH_SIZES)
def test_ingest_staged_events_http(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
    size: int,
) -> None:
    token = f"{TOKEN_PREFIX}benchmark"

    async def seed() -> None:
        await seed_staged_ingest(session, save_fixture, organization)
        await save_fixture(
            OrganizationAccessToken(
                comment="benchmark",
                token=get_token_hash(token),
                organization=organization,
                scope=Scope.events_write.value,
            )
        )

    run(seed())
    bind = session.bind
    assert bind is not None
    instrument_sqlalchemy([bind.sync_engine])

    app: ASGIApp = rate_limit.get_middleware(polar_app, redis)
    app = AuthSubjectMiddleware(app)
    app = TransactionalMiddleware(app)
    app = rate_limit.get_authentication_middleware(app, redis)
    app = rate_limit.get_ip_middleware(app, redis)
    app = HttpMetricsMiddleware(app)
    state = {
        "async_sessionmaker": async_sessionmaker(bind=bind, expire_on_commit=False),
        "redis": redis,
    }

    async def app_with_state(scope: ASGIScope, receive: Receive, send: Send) -> None:
        scope.setdefault("state", {}).update(state)
        await app(scope, receive, send)

    client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_with_state),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    )
    batches = itertools.count()

    def ingest_batch() -> int:
        response = run(
            client.post(
                "/v1/events/ingest", json={"events": staged_events(size, next(batches))}
            )
        )
        return response.json()["inserted"]

    assert ingest_batch() == size
    analyze(run, session)
    benchmark(ingest_batch)
    run(client.aclose())


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
