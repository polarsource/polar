import uuid
from datetime import UTC, datetime, timedelta

import pytest

from polar.models import Organization, Reducer, StagedEvent, User
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.postgres import AsyncSession
from polar.reducer.repository import ReducerRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_account,
    create_event,
    create_meter,
    create_organization,
    create_reducer,
)

START = datetime(2026, 10, 7, 12, 5, tzinfo=UTC)
END = START + timedelta(minutes=5)


async def create_usage_reducer(
    save_fixture: SaveFixture, organization: Organization
) -> Reducer:
    meter = await create_meter(save_fixture, id=uuid.uuid4(), organization=organization)
    return await create_reducer(save_fixture, organization=organization, meters=[meter])


@pytest.mark.anyio
class TestGetAllActiveWithEvents:
    async def test_organizations_with_events_or_staged_events_in_the_range(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        idle_organization = await create_organization(
            save_fixture, await create_account(save_fixture, user)
        )
        event_reducer = await create_usage_reducer(save_fixture, organization)
        staged_reducer = await create_usage_reducer(save_fixture, organization_second)
        await create_usage_reducer(save_fixture, idle_organization)
        in_range = START + timedelta(minutes=1)
        await create_event(save_fixture, organization=organization, timestamp=in_range)
        await create_event(save_fixture, organization=idle_organization, timestamp=END)
        await save_fixture(
            StagedEvent(
                name=METER_TEST_EVENT,
                source=EventSource.user,
                timestamp=in_range,
                organization_id=organization_second.id,
                user_metadata={},
            )
        )

        reducers = await ReducerRepository.from_session(
            session
        ).get_all_active_with_events((ReducerKind.usage,), START, END)

        assert {reducer.id for reducer in reducers} == {
            event_reducer.id,
            staged_reducer.id,
        }
