import pytest
from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.event.repository import EventRepository
from polar.event.schemas import EventCreateExternalCustomer, EventsIngest
from polar.event.service import event as event_service
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Event, Organization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_event,
    create_organization,
)


@pytest.mark.asyncio
class TestGetAncestorsBatch:
    async def test_root_event_has_no_ancestors(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Test that a root event has no ancestors."""
        organization = await create_organization(save_fixture, account)

        # Create root event
        root = await create_event(
            save_fixture,
            organization=organization,
            name="root",
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_ancestors_batch([root.id])

        # Root events should not appear in the result (no ancestors)
        assert root.id not in result

    async def test_child_has_parent_as_ancestor(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Test that a child event has its parent as ancestor."""
        organization = await create_organization(save_fixture, account)

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

        repository = EventRepository.from_session(session)
        result = await repository.get_ancestors_batch([child.id])

        # Should have 1 ancestor: the parent
        assert result[child.id] == [str(root.id)]

    async def test_grandchild_ancestors_ordered_by_depth(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Test that ancestors are ordered by depth for deeper hierarchies."""
        organization = await create_organization(save_fixture, account)

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

        repository = EventRepository.from_session(session)
        result = await repository.get_ancestors_batch([grandchild.id])

        # Should have 2 ancestors: parent (depth 1), grandparent (depth 2)
        assert result[grandchild.id] == [str(child.id), str(root.id)]

    async def test_batch_with_multiple_events(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Test that ancestors are correctly computed for a batch of events."""
        organization = await create_organization(save_fixture, account)

        # Create root with 3 children
        root = await create_event(
            save_fixture,
            organization=organization,
            name="root",
        )

        children = []
        for i in range(3):
            child = await create_event(
                save_fixture,
                organization=organization,
                name=f"child{i}",
                parent_id=root.id,
            )
            children.append(child)

        repository = EventRepository.from_session(session)
        result = await repository.get_ancestors_batch(
            [root.id] + [c.id for c in children]
        )

        # Root should have no ancestors
        assert root.id not in result

        # Each child should have root as its only ancestor
        for child in children:
            assert result[child.id] == [str(root.id)]

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_batch_ingest_out_of_order(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        """
        Test that ancestors are correctly computed when multiple hierarchical
        events are ingested in a single batch, even when out of order.
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
        # This tests that the recursive CTE handles out-of-order ingestion

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

        await event_service.ingest(session, auth_subject, ingest)

        # Build ancestors (normally done by background worker)
        id_result = await session.execute(
            select(Event.id).where(Event.organization_id == organization.id)
        )
        event_ids = [row[0] for row in id_result.all()]

        repository = EventRepository.from_session(session)
        ancestors = await repository.get_ancestors_batch(event_ids)

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

        # Verify ancestors for root (should have none)
        assert root.id not in ancestors

        # Verify ancestors for children (should have root)
        assert ancestors[child1.id] == [str(root.id)]
        assert ancestors[child2.id] == [str(root.id)]

        # Verify ancestors for grandchildren (parent first, then root)
        assert ancestors[grandchild1.id] == [str(child1.id), str(root.id)]
        assert ancestors[grandchild2.id] == [str(child2.id), str(root.id)]
