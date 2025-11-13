import pytest
from sqlalchemy import func, select, update

from polar.kit.db.postgres import AsyncSession
from polar.models import Event, EventType, Organization
from polar.models.event import EventSource
from scripts.backfill_event_types import run_backfill
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestBackfillEventTypes:
    async def test_backfills_event_types(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        event1 = Event(
            name="api.request",
            source=EventSource.user,
            organization_id=organization.id,
        )
        await save_fixture(event1)

        event2 = Event(
            name="api.request",
            source=EventSource.user,
            organization_id=organization.id,
        )
        await save_fixture(event2)

        event3 = Event(
            name="api.response",
            source=EventSource.user,
            organization_id=organization.id,
        )
        await save_fixture(event3)

        await session.execute(update(Event).values(event_type_id=None))
        await session.commit()

        events_without_group = (
            await session.execute(
                select(func.count())
                .select_from(Event)
                .where(Event.event_type_id.is_(None))
            )
        ).scalar_one()
        assert events_without_group == 3

        await run_backfill(batch_size=10, session=session)

        request_group_result = await session.execute(
            select(EventType).where(
                EventType.name == "api.request",
                EventType.organization_id == organization.id,
            )
        )
        request_group = request_group_result.scalar_one()
        assert request_group.name == "api.request"
        assert request_group.label == "api.request"

        response_group_result = await session.execute(
            select(EventType).where(
                EventType.name == "api.response",
                EventType.organization_id == organization.id,
            )
        )
        response_group = response_group_result.scalar_one()
        assert response_group.name == "api.response"

        event1_result = await session.execute(
            select(Event).where(Event.id == event1.id)
        )
        updated_event1 = event1_result.scalar_one()
        assert updated_event1.event_type_id == request_group.id

        event2_result = await session.execute(
            select(Event).where(Event.id == event2.id)
        )
        updated_event2 = event2_result.scalar_one()
        assert updated_event2.event_type_id == request_group.id

        event3_result = await session.execute(
            select(Event).where(Event.id == event3.id)
        )
        updated_event3 = event3_result.scalar_one()
        assert updated_event3.event_type_id == response_group.id

        remaining_events = (
            await session.execute(
                select(func.count())
                .select_from(Event)
                .where(Event.event_type_id.is_(None))
            )
        ).scalar_one()
        assert remaining_events == 0
