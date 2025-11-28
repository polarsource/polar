import pytest
from sqlalchemy import func, select

from polar.auth.models import AuthSubject
from polar.event.schemas import EventCreateExternalCustomer, EventsIngest
from polar.event.service import event as event_service
from polar.kit.db.postgres import AsyncSession
from polar.models import Event, EventClosure, Organization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_event,
    create_organization,
)


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

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_closure_table_batch_ingest_out_of_order(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        """
        Test that closure table is correctly populated when multiple hierarchical
        events are ingested in a single batch, even when out of order.

        Tests the topological sort in populate_event_closures_batch.
        """
        customer = await create_customer(
            save_fixture, organization=organization, external_id="test-customer-123"
        )
        assert customer.external_id is not None

        # Create a complex hierarchy ingested OUT OF ORDER:
        #
        #       root
        #      /    \
        #   child1  child2
        #     |       |
        # grandchild1 grandchild2
        #
        # Ingest order: grandchild2, child1, grandchild1, root, child2
        # This tests that topological sort handles out-of-order ingestion

        ingest = EventsIngest(
            events=[
                # Grandchild before its parent and grandparent
                EventCreateExternalCustomer(
                    name="step4",
                    external_customer_id=customer.external_id,
                    external_id="grandchild2",
                    parent_id="child2",
                ),
                # Child before root
                EventCreateExternalCustomer(
                    name="step2",
                    external_customer_id=customer.external_id,
                    external_id="child1",
                    parent_id="root",
                ),
                # Another grandchild before root
                EventCreateExternalCustomer(
                    name="step3",
                    external_customer_id=customer.external_id,
                    external_id="grandchild1",
                    parent_id="child1",
                ),
                # Root event in the middle
                EventCreateExternalCustomer(
                    name="step1",
                    external_customer_id=customer.external_id,
                    external_id="root",
                ),
                # Another child after root
                EventCreateExternalCustomer(
                    name="step2b",
                    external_customer_id=customer.external_id,
                    external_id="child2",
                    parent_id="root",
                ),
            ]
        )

        response = await event_service.ingest(session, auth_subject, ingest)

        # Manually populate closure table (normally done by background worker)
        id_result = await session.execute(
            select(Event.id).where(Event.organization_id == organization.id)
        )
        event_ids = [row[0] for row in id_result.all()]
        await event_service.populate_event_closures_batch(session, event_ids)

        # Get all events
        event_result = await session.execute(
            select(Event)
            .where(Event.organization_id == organization.id)
            .order_by(Event.name)
        )
        events: dict[str | None, Event] = {
            e.external_id: e for e in event_result.scalars().all()
        }

        assert len(events) == 5

        root = events["root"]
        child1 = events["child1"]
        child2 = events["child2"]
        grandchild1 = events["grandchild1"]
        grandchild2 = events["grandchild2"]

        # Verify parent_id and root_id are correct
        assert root.parent_id is None
        assert root.root_id == root.id

        assert child1.parent_id == root.id
        assert child1.root_id == root.id

        assert child2.parent_id == root.id
        assert child2.root_id == root.id

        assert grandchild1.parent_id == child1.id
        assert grandchild1.root_id == root.id

        assert grandchild2.parent_id == child2.id
        assert grandchild2.root_id == root.id

        # Verify closure table for root (should have 4 descendants)
        result = await session.execute(
            select(EventClosure)
            .where(EventClosure.ancestor_id == root.id)
            .order_by(EventClosure.depth, EventClosure.descendant_id)
        )
        root_closures = result.scalars().all()

        # Root should have: self (1) + children (2) + grandchildren (2) = 5 entries
        assert len(root_closures) == 5

        depths = {c.descendant_id: c.depth for c in root_closures}
        assert depths[root.id] == 0
        assert depths[child1.id] == 1
        assert depths[child2.id] == 1
        assert depths[grandchild1.id] == 2
        assert depths[grandchild2.id] == 2

        # Verify closure table for child1 (should have 1 descendant)
        result = await session.execute(
            select(EventClosure)
            .where(EventClosure.ancestor_id == child1.id)
            .order_by(EventClosure.depth)
        )
        child1_closures = result.scalars().all()

        # child1 should have: self (1) + grandchild1 (1) = 2 entries
        assert len(child1_closures) == 2
        assert child1_closures[0].descendant_id == child1.id
        assert child1_closures[0].depth == 0
        assert child1_closures[1].descendant_id == grandchild1.id
        assert child1_closures[1].depth == 1

        # Verify closure table for grandchild1 (should have all ancestors)
        result = await session.execute(
            select(EventClosure)
            .where(EventClosure.descendant_id == grandchild1.id)
            .order_by(EventClosure.depth)
        )
        grandchild1_closures = result.scalars().all()

        # grandchild1 should have: self (1) + parent (1) + grandparent (1) = 3 entries
        assert len(grandchild1_closures) == 3
        assert grandchild1_closures[0].ancestor_id == grandchild1.id
        assert grandchild1_closures[0].depth == 0
        assert grandchild1_closures[1].ancestor_id == child1.id
        assert grandchild1_closures[1].depth == 1
        assert grandchild1_closures[2].ancestor_id == root.id
        assert grandchild1_closures[2].depth == 2
