import itertools
import random
import typing
import uuid
from collections.abc import Sequence

import httpx2
import pytest
from pytest_codspeed import BenchmarkFixture
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import async_sessionmaker
from starlette.types import ASGIApp, Receive, Send
from starlette.types import Scope as ASGIScope

from polar import rate_limit
from polar.app import app as polar_app
from polar.auth.middlewares import AuthSubjectMiddleware
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.config import settings
from polar.event.repository import EventRepository
from polar.event.schemas import EventCreateExternalCustomer, EventsIngest
from polar.event.service import event as event_service
from polar.kit.crypto import get_token_hash
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.logfire import instrument_sqlalchemy
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.middlewares import TransactionalMiddleware
from polar.models import CustomerMeter, Organization, OrganizationAccessToken
from polar.models.event import EventSource
from polar.observability.http_middleware import HttpMetricsMiddleware
from polar.organization_access_token.service import TOKEN_PREFIX
from polar.organization_access_token.service import (
    organization_access_token as organization_access_token_service,
)
from polar.redis import Redis
from polar.reducer.service import REDUCER_BUCKET_SIZE, get_reducer_bucket_start
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_customer,
    create_meter,
    create_reducer,
)

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


async def seed_reducer_billed_organization(
    session: AsyncSession, save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "reducer_billing_enabled": True,
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
    run(seed_reducer_billed_organization(session, save_fixture, organization))
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
    monkeypatch: pytest.MonkeyPatch,
    size: int,
) -> None:
    monkeypatch.setattr(settings, "ORGANIZATION_ACCESS_TOKEN_CACHE_TTL_SECONDS", 60)
    monkeypatch.setattr(organization_access_token_service, "_cache", {})
    token = f"{TOKEN_PREFIX}benchmark"

    async def seed() -> None:
        await seed_reducer_billed_organization(session, save_fixture, organization)
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

    client = httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=app_with_state),
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


# Customers whose meters their events never match: their customer meters stay unactivated, and
# every batch checks them all again.
def test_ingested_50_customers_with_4_unactivated_meters(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    repository = EventRepository.from_session(session)

    async def seed() -> Sequence[uuid.UUID]:
        meters = [
            await create_meter(save_fixture, organization=organization, id=uuid.uuid4())
            for _ in range(4)
        ]
        rows: list[dict[str, typing.Any]] = []
        for index in range(50):
            customer = await create_customer(
                save_fixture,
                organization=organization,
                email=f"customer-{index}@example.com",
                stripe_customer_id=None,
            )
            for meter in meters:
                await save_fixture(
                    CustomerMeter(customer=customer, meter=meter, activated_at=None)
                )
            event_id = uuid.uuid4()
            rows.append(
                {
                    "id": event_id,
                    "name": "benchmark.unmetered",
                    "source": EventSource.user,
                    "organization_id": organization.id,
                    "customer_id": customer.id,
                    "root_id": event_id,
                }
            )
        event_ids, _ = await repository.insert_batch(rows)
        return event_ids

    event_ids = run(seed())
    analyze(run, session)
    benchmark.pedantic(
        lambda: run(event_service.ingested(session, event_ids)), rounds=5
    )


# A batch from the mover: 1,000 events over 1,000 customers, each customer with one meter its
# events match, already activated, and 49 meters its events never match.
def test_ingested_1000_customers_with_49_unactivated_meters(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    repository = EventRepository.from_session(session)

    async def seed() -> Sequence[uuid.UUID]:
        matched_meter = await create_meter(
            save_fixture, organization=organization, id=uuid.uuid4()
        )
        unmatched_meters = [
            await create_meter(
                save_fixture,
                organization=organization,
                id=uuid.uuid4(),
                filter=Filter(
                    conjunction=FilterConjunction.and_,
                    clauses=[
                        FilterClause(
                            property="name",
                            operator=FilterOperator.eq,
                            value=f"benchmark.unmetered-{index}",
                        )
                    ],
                ),
            )
            for index in range(49)
        ]
        customers = [
            await create_customer(
                save_fixture,
                organization=organization,
                external_id=f"customer-{index}",
                email=f"customer-{index}@example.com",
                stripe_customer_id=None,
            )
            for index in range(1_000)
        ]
        await session.execute(
            insert(CustomerMeter),
            [
                {
                    "customer_id": customer.id,
                    "meter_id": meter.id,
                    "activated_at": utc_now() if meter is matched_meter else None,
                }
                for customer in customers
                for meter in [matched_meter, *unmatched_meters]
            ],
        )
        rows: list[dict[str, typing.Any]] = []
        for customer in customers:
            event_id = uuid.uuid4()
            rows.append(
                {
                    "id": event_id,
                    "name": METER_TEST_EVENT,
                    "source": EventSource.user,
                    "organization_id": organization.id,
                    "customer_id": customer.id,
                    "external_customer_id": customer.external_id,
                    "root_id": event_id,
                }
            )
        event_ids, _ = await repository.insert_batch(rows)
        return event_ids

    event_ids = run(seed())
    analyze(run, session)
    benchmark.pedantic(
        lambda: run(event_service.ingested(session, event_ids)), rounds=5
    )
