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

    async def test_backfills_partially_filled_database(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        processed_root = Event(
            name="test.processed_root",
            source=EventSource.user,
            organization_id=organization.id,
            parent_id=None,
        )
        await save_fixture(processed_root)

        unprocessed_root_1 = Event(
            name="test.unprocessed_root_1",
            source=EventSource.user,
            organization_id=organization.id,
            parent_id=None,
        )
        await save_fixture(unprocessed_root_1)

        unprocessed_root_2 = Event(
            name="test.unprocessed_root_2",
            source=EventSource.user,
            organization_id=organization.id,
            parent_id=None,
        )
        await save_fixture(unprocessed_root_2)

        await session.execute(
            delete(EventClosure).where(
                EventClosure.descendant_id.in_(
                    [unprocessed_root_1.id, unprocessed_root_2.id]
                )
            )
        )
        await session.execute(
            update(Event)
            .where(Event.id.in_([unprocessed_root_1.id, unprocessed_root_2.id]))
            .values(root_id=None)
        )

        count_before = (await session.execute(select(EventClosure))).scalars().all()
        assert len(count_before) == 1

        await run_backfill(batch_size=1, session=session)

        result_1 = await session.execute(
            select(Event).where(Event.id == unprocessed_root_1.id)
        )
        updated_1 = result_1.scalar_one()
        assert updated_1.root_id == unprocessed_root_1.id

        result_2 = await session.execute(
            select(Event).where(Event.id == unprocessed_root_2.id)
        )
        updated_2 = result_2.scalar_one()
        assert updated_2.root_id == unprocessed_root_2.id

        closures = (await session.execute(select(EventClosure))).scalars().all()
        assert len(closures) == 3

        unprocessed_1_closures = (
            (
                await session.execute(
                    select(EventClosure).where(
                        EventClosure.descendant_id == unprocessed_root_1.id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(unprocessed_1_closures) == 1
        assert unprocessed_1_closures[0].ancestor_id == unprocessed_root_1.id
        assert unprocessed_1_closures[0].depth == 0

        unprocessed_2_closures = (
            (
                await session.execute(
                    select(EventClosure).where(
                        EventClosure.descendant_id == unprocessed_root_2.id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(unprocessed_2_closures) == 1
        assert unprocessed_2_closures[0].ancestor_id == unprocessed_root_2.id
        assert unprocessed_2_closures[0].depth == 0

    async def test_backfills_inconsistent_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        root_with_root_no_closure = Event(
            name="test.root_with_root_no_closure",
            source=EventSource.user,
            organization_id=organization.id,
            parent_id=None,
        )
        await save_fixture(root_with_root_no_closure)

        child_with_closure_no_root = Event(
            name="test.child_with_closure_no_root",
            source=EventSource.user,
            organization_id=organization.id,
            parent_id=root_with_root_no_closure.id,
        )
        await save_fixture(child_with_closure_no_root)

        await session.execute(
            delete(EventClosure).where(
                EventClosure.descendant_id == root_with_root_no_closure.id
            )
        )
        await session.execute(
            update(Event)
            .where(Event.id == child_with_closure_no_root.id)
            .values(root_id=None)
        )

        result = await session.execute(
            select(Event).where(Event.id == root_with_root_no_closure.id)
        )
        event_before = result.scalar_one()
        assert event_before.root_id == root_with_root_no_closure.id

        result = await session.execute(
            select(EventClosure).where(
                EventClosure.descendant_id == root_with_root_no_closure.id
            )
        )
        closure_before = result.scalars().all()
        assert len(closure_before) == 0

        result = await session.execute(
            select(Event).where(Event.id == child_with_closure_no_root.id)
        )
        child_before = result.scalar_one()
        assert child_before.root_id is None

        result = await session.execute(
            select(EventClosure).where(
                EventClosure.descendant_id == child_with_closure_no_root.id
            )
        )
        child_closure_before = result.scalars().all()
        assert len(child_closure_before) > 0

        await run_backfill(batch_size=10, session=session)

        closure_result = await session.execute(
            select(EventClosure).where(
                EventClosure.descendant_id == root_with_root_no_closure.id
            )
        )
        closure_after = closure_result.scalars().all()
        assert len(closure_after) == 1
        assert closure_after[0].ancestor_id == root_with_root_no_closure.id
        assert closure_after[0].depth == 0

        result = await session.execute(
            select(Event).where(Event.id == child_with_closure_no_root.id)
        )
        child_after = result.scalar_one()
        assert child_after.root_id == root_with_root_no_closure.id
