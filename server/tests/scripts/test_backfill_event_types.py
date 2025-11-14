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

    async def test_backfills_event_types_with_batching(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        num_unique_event_types = 10
        events_per_type = 3
        batch_size = 3

        for i in range(num_unique_event_types):
            for j in range(events_per_type):
                event = Event(
                    name=f"event.type.{i}",
                    source=EventSource.user,
                    organization_id=organization.id,
                )
                await save_fixture(event)

        await session.execute(update(Event).values(event_type_id=None))

        events_without_group = (
            await session.execute(
                select(func.count())
                .select_from(Event)
                .where(Event.event_type_id.is_(None))
            )
        ).scalar_one()
        assert events_without_group == num_unique_event_types * events_per_type

        await run_backfill(batch_size=batch_size, session=session)

        event_types_result = await session.execute(
            select(EventType).where(EventType.organization_id == organization.id)
        )
        event_types = event_types_result.scalars().all()
        assert len(event_types) == num_unique_event_types

        for i in range(num_unique_event_types):
            event_type_result = await session.execute(
                select(EventType).where(
                    EventType.name == f"event.type.{i}",
                    EventType.organization_id == organization.id,
                )
            )
            event_type = event_type_result.scalar_one()
            assert event_type.name == f"event.type.{i}"
            assert event_type.label == f"event.type.{i}"

            events_result = await session.execute(
                select(Event).where(
                    Event.name == f"event.type.{i}",
                    Event.organization_id == organization.id,
                )
            )
            events = events_result.scalars().all()
            assert len(events) == events_per_type
            for event in events:
                assert event.event_type_id == event_type.id

        remaining_events = (
            await session.execute(
                select(func.count())
                .select_from(Event)
                .where(Event.event_type_id.is_(None))
            )
        ).scalar_one()
        assert remaining_events == 0

    async def test_backfills_with_multiple_organizations(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        event_org1 = Event(
            name="shared.event",
            source=EventSource.user,
            organization_id=organization.id,
        )
        await save_fixture(event_org1)

        event_org2 = Event(
            name="shared.event",
            source=EventSource.user,
            organization_id=organization_second.id,
        )
        await save_fixture(event_org2)

        await session.execute(update(Event).values(event_type_id=None))

        await run_backfill(batch_size=10, session=session)

        event_type_org1_result = await session.execute(
            select(EventType).where(
                EventType.name == "shared.event",
                EventType.organization_id == organization.id,
            )
        )
        event_type_org1 = event_type_org1_result.scalar_one()

        event_type_org2_result = await session.execute(
            select(EventType).where(
                EventType.name == "shared.event",
                EventType.organization_id == organization_second.id,
            )
        )
        event_type_org2 = event_type_org2_result.scalar_one()

        assert event_type_org1.id != event_type_org2.id

        updated_event_org1_result = await session.execute(
            select(Event).where(Event.id == event_org1.id)
        )
        updated_event_org1 = updated_event_org1_result.scalar_one()
        assert updated_event_org1.event_type_id == event_type_org1.id

        updated_event_org2_result = await session.execute(
            select(Event).where(Event.id == event_org2.id)
        )
        updated_event_org2 = updated_event_org2_result.scalar_one()
        assert updated_event_org2.event_type_id == event_type_org2.id

        remaining_events = (
            await session.execute(
                select(func.count())
                .select_from(Event)
                .where(Event.event_type_id.is_(None))
            )
        ).scalar_one()
        assert remaining_events == 0
