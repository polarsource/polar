import typing
import uuid
from datetime import UTC, datetime

import pytest
from pytest_codspeed import BenchmarkFixture

from polar.kit.db.postgres import AsyncSession
from polar.models import Event, Organization
from polar.redis import Redis
from polar.reducer.service import reducer as reducer_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import METER_TEST_EVENT, create_meter, create_reducer

from .conftest import Run

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
            meter = await create_meter(
                save_fixture, organization=organization, id=uuid.uuid4()
            )
            await create_reducer(
                save_fixture, organization=organization, meters=[meter]
            )

    run(seed())
    events = build_events(organization, 100)
    contributed = run(reducer_service.rollup(session, redis, organization.id, events))
    assert contributed == reducers * 10
    benchmark(
        lambda: run(reducer_service.rollup(session, redis, organization.id, events))
    )
