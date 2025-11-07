import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from polar.models import EventClosure
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event, create_organization


@pytest.mark.asyncio
class TestClosureTable:
    async def test_closure_table_population_root_event(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that closure table is populated for a root event."""
        organization = await create_organization(save_fixture)

        # Create root event
        root = await create_event(
            save_fixture,
            organization=organization,
            name="root",
        )

        # Check that root_id is set to itself
        assert root.root_id == root.id

        # Check closure table has self-reference
        result = await session.execute(
            select(EventClosure).where(EventClosure.descendant_id == root.id)
        )
        closures = result.scalars().all()

        assert len(closures) == 1
        assert closures[0].ancestor_id == root.id
        assert closures[0].descendant_id == root.id
        assert closures[0].depth == 0

    async def test_closure_table_population_with_parent(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that closure table is populated for events with parents."""
        organization = await create_organization(save_fixture)

        # Create root event
        root = await create_event(
            save_fixture,
            organization=organization,
            name="root",
        )

        # Create child event
        child = await create_event(
            save_fixture,
            organization=organization,
            name="child",
            parent_id=root.id,
        )

        # Check that child has correct root_id
        assert child.root_id == root.id
        assert child.parent_id == root.id

        # Check closure table for child
        result = await session.execute(
            select(EventClosure).where(EventClosure.descendant_id == child.id)
        )
        closures = result.scalars().all()

        # Should have 2 rows: self-reference and link to parent
        assert len(closures) == 2

        # Find the rows
        self_ref = next((c for c in closures if c.depth == 0), None)
        parent_link = next((c for c in closures if c.depth == 1), None)

        assert self_ref is not None
        assert self_ref.ancestor_id == child.id
        assert self_ref.descendant_id == child.id

        assert parent_link is not None
        assert parent_link.ancestor_id == root.id
        assert parent_link.descendant_id == child.id

    async def test_closure_table_population_grandchild(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that closure table is populated correctly for deeper hierarchies."""
        organization = await create_organization(save_fixture)

        # Create root -> child -> grandchild
        root = await create_event(
            save_fixture,
            organization=organization,
            name="root",
        )

        child = await create_event(
            save_fixture,
            organization=organization,
            name="child",
            parent_id=root.id,
        )

        grandchild = await create_event(
            save_fixture,
            organization=organization,
            name="grandchild",
            parent_id=child.id,
        )

        # Check root_id propagation
        assert root.root_id == root.id
        assert child.root_id == root.id
        assert grandchild.root_id == root.id

        # Check closure table for grandchild
        result = await session.execute(
            select(EventClosure)
            .where(EventClosure.descendant_id == grandchild.id)
            .order_by(EventClosure.depth)
        )
        closures = result.scalars().all()

        # Should have 3 rows: self (depth 0), parent (depth 1), grandparent (depth 2)
        assert len(closures) == 3

        assert closures[0].ancestor_id == grandchild.id
        assert closures[0].depth == 0

        assert closures[1].ancestor_id == child.id
        assert closures[1].depth == 1

        assert closures[2].ancestor_id == root.id
        assert closures[2].depth == 2

    async def test_child_count_calculation(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that child_count is correctly calculated from closure table."""
        organization = await create_organization(save_fixture)

        # Create root with 3 children
        root = await create_event(
            save_fixture,
            organization=organization,
            name="root",
        )

        for i in range(3):
            await create_event(
                save_fixture,
                organization=organization,
                name=f"child{i}",
                parent_id=root.id,
            )

        # Count descendants from closure table (excluding self-reference)
        result = await session.execute(
            select(func.count())
            .select_from(EventClosure)
            .where(
                EventClosure.ancestor_id == root.id,
                EventClosure.depth > 0,
            )
        )
        child_count = result.scalar()

        assert child_count == 3
