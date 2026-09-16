from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import (
    Customer,
    Organization,
    VoidBillingIdentity,
    VoidMeter,
    VoidReducer,
    VoidReducerBucket,
)
from polar.postgres import AsyncSession
from polar.void.identity.schemas import IdentityCreate
from polar.void.identity.service import identity as identity_service
from polar.void.meter.schemas import MeterCreate
from polar.void.meter.service import meter as meter_service
from polar.void.postgres import get_snapshot_session
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import reducer as reducer_service
from polar.void.tinybird import TinybirdApi, get_client
from tests.fixtures.database import SaveFixture
from tests.void.conftest import VERSION, activate_version
from tests.void.test_endpoints import TOKEN, create_token

AT = datetime(2026, 9, 15, 12, 4, tzinfo=UTC)
START = AT.replace(minute=0)


@dataclass
class Graph:
    root: VoidBillingIdentity
    child: VoidBillingIdentity
    sibling: VoidBillingIdentity
    usage: VoidReducer
    credit: VoidReducer
    meter: VoidMeter


@pytest.fixture
def tinybird() -> Mock:
    client = Mock(spec=TinybirdApi)
    client.query.return_value = {"data": []}
    return client


@pytest_asyncio.fixture
async def snapshot_dependencies(
    app: FastAPI, session: AsyncSession, tinybird: Mock
) -> AsyncIterator[None]:
    app.dependency_overrides[get_snapshot_session] = lambda: session
    app.dependency_overrides[get_client] = lambda: tinybird
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_snapshot_session)
        app.dependency_overrides.pop(get_client)


@pytest_asyncio.fixture
async def state_client(
    void_client: AsyncClient,
    save_fixture: SaveFixture,
    organization: Organization,
    snapshot_dependencies: None,
) -> AsyncClient:
    await create_token(
        save_fixture, organization, scopes={Scope.void_write, Scope.customers_read}
    )
    void_client.headers.update(
        {"Authorization": f"Bearer {TOKEN}", "x-void-config": "test-config"}
    )
    return void_client


@pytest_asyncio.fixture
async def graph(
    session: AsyncSession,
    organization: Organization,
    customer: Customer,
    save_fixture: SaveFixture,
) -> Graph:
    root, _ = await identity_service.ensure(
        session, organization, IdentityCreate(external_id="root")
    )
    child, _ = await identity_service.ensure(
        session,
        organization,
        IdentityCreate(external_id="child", parent_external_id="root"),
    )
    sibling, _ = await identity_service.ensure(
        session,
        organization,
        IdentityCreate(external_id="sibling", parent_external_id="root"),
    )
    await identity_service.ensure(
        session, organization, IdentityCreate(external_id="outsider")
    )
    customer.root_identity = root
    await save_fixture(customer)
    usage = await reducer_service.create(
        session,
        organization.id,
        ReducerCreate.model_validate(
            {
                "slug": "usage",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "count"},
            }
        ),
    )
    credit = await reducer_service.create(
        session,
        organization.id,
        ReducerCreate.model_validate(
            {
                "slug": "credit",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "sum", "property": "amount"},
            }
        ),
    )
    meter = await meter_service.create(
        session,
        organization.id,
        MeterCreate(
            version_id=VERSION,
            name="Tokens",
            slug="tokens",
            usage_reducer_id=usage.id,
            credit_reducer_id=credit.id,
            unit_amount=Decimal("0.01"),
        ),
    )
    for reducer, actor, value, start, age in (
        (usage, "child", 3, START - timedelta(minutes=5), 3),
        (usage, "child", 5, START, 2),
        (usage, "sibling", 70, START, 1),
        (usage, "outsider", 900, START, 0),
        (credit, "root", 100, START, 2),
        (credit, "child", 20, START, 1),
    ):
        await save_fixture(
            VoidReducerBucket(
                organization=organization,
                reducer=reducer,
                external_identity_id=actor,
                external_root_id="outsider" if actor == "outsider" else "root",
                bucket_start=start,
                value=value,
                last_processed_event={
                    "external_id": f"{actor}-{value}",
                    "timestamp": start.isoformat(),
                    "ingested_at": (AT - timedelta(seconds=age)).isoformat(),
                    "event_ids": [f"{actor}-{value}", f"{actor}-{value}-duplicate"],
                },
            )
        )
    await activate_version(save_fixture, organization)
    return Graph(root, child, sibling, usage, credit, meter)
