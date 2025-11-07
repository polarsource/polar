import pytest
from sqlalchemy import delete, select, update

from polar.kit.db.postgres import AsyncSession
from polar.models import Event, EventClosure, Organization
from polar.models.event import EventSource
from scripts.backfill_event_closure import run_backfill
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestBackfillEventClosure:
    async def test_backfills_event_hierarchy(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        root_event = Event(
            name="test.root",
            source=EventSource.user,
            organization_id=organization.id,
            parent_id=None,
        )
        await save_fixture(root_event)

        child_event = Event(
            name="test.child",
            source=EventSource.user,
            organization_id=organization.id,
            parent_id=root_event.id,
        )
        await save_fixture(child_event)

        grandchild_event = Event(
            name="test.grandchild",
            source=EventSource.user,
            organization_id=organization.id,
            parent_id=child_event.id,
        )
        await save_fixture(grandchild_event)

        # Clear closure table and root_id to simulate old database state
        await session.execute(delete(EventClosure))
        await session.execute(update(Event).values(root_id=None))
        await session.commit()

        await run_backfill(batch_size=10, session=session)

        root_result = await session.execute(
            select(Event).where(Event.id == root_event.id)
        )
        updated_root = root_result.scalar_one()
        assert updated_root.root_id == root_event.id

        child_result = await session.execute(
            select(Event).where(Event.id == child_event.id)
        )
        updated_child = child_result.scalar_one()
        assert updated_child.root_id == root_event.id

        grandchild_result = await session.execute(
            select(Event).where(Event.id == grandchild_event.id)
        )
        updated_grandchild = grandchild_result.scalar_one()
        assert updated_grandchild.root_id == root_event.id

        closure_result = await session.execute(
            select(EventClosure)
            .where(EventClosure.descendant_id == grandchild_event.id)
            .order_by(EventClosure.depth)
        )
        closures = closure_result.scalars().all()
        assert len(closures) == 3
        assert closures[0].ancestor_id == grandchild_event.id
        assert closures[0].depth == 0
        assert closures[1].ancestor_id == child_event.id
        assert closures[1].depth == 1
        assert closures[2].ancestor_id == root_event.id
        assert closures[2].depth == 2
