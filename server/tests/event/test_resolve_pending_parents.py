import uuid
from collections.abc import Sequence
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import select

from polar.event.repository import EventRepository
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Event, Organization
from polar.models.event import EventSource
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization


def _make_event(
    organization: Organization,
    external_id: str,
    *,
    pending_parent_external_id: str | None = None,
) -> dict[str, Any]:
    event_id = uuid.uuid4()
    return {
        "id": event_id,
        "name": f"event.{external_id}",
        "source": EventSource.user,
        "organization_id": organization.id,
        "external_id": external_id,
        "pending_parent_external_id": pending_parent_external_id,
        "root_id": event_id if pending_parent_external_id is None else None,
    }


async def _get_events(
    session: AsyncSession, organization: Organization
) -> dict[str | None, Event]:
    result = await session.execute(
        select(Event).where(Event.organization_id == organization.id)
    )
    return {e.external_id: e for e in result.scalars().all()}


async def _resolve(
    repository: EventRepository, event_ids: Sequence[UUID]
) -> list[UUID]:
    resolvable = await repository.find_resolvable_parents(event_ids)
    await repository.resolve_parents(resolvable)
    return [r[0] for r in resolvable]


@pytest.mark.asyncio
class TestResolvePendingParents:
    async def test_no_pending_events(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        events = [_make_event(organization, "a"), _make_event(organization, "b")]
        event_ids, _ = await repository.insert_batch(events)

        resolved = await _resolve(repository, event_ids)

        assert resolved == []

    async def test_parent_and_child_in_same_batch(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Child references parent, both in the same batch."""
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        events = [
            _make_event(organization, "child", pending_parent_external_id="parent"),
            _make_event(organization, "parent"),
        ]
        event_ids, _ = await repository.insert_batch(events)
        resolved = await _resolve(repository, event_ids)

        assert len(resolved) == 1
        by_ext = await _get_events(session, organization)
        child = by_ext["child"]
        parent = by_ext["parent"]

        assert child.parent_id == parent.id
        assert child.root_id == parent.id
        assert child.pending_parent_external_id is None

    async def test_three_level_hierarchy_in_same_batch(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """root → child → grandchild, all in one batch, inserted in reverse order."""
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        events = [
            _make_event(organization, "grandchild", pending_parent_external_id="child"),
            _make_event(organization, "child", pending_parent_external_id="root"),
            _make_event(organization, "root"),
        ]
        event_ids, _ = await repository.insert_batch(events)
        resolved = await _resolve(repository, event_ids)

        assert len(resolved) == 2
        by_ext = await _get_events(session, organization)
        root = by_ext["root"]
        child = by_ext["child"]
        grandchild = by_ext["grandchild"]

        assert child.parent_id == root.id
        assert child.root_id == root.id

        assert grandchild.parent_id == child.id
        assert grandchild.root_id == root.id

    async def test_parent_already_in_db(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Parent was inserted in a previous batch, child arrives later."""
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        # Batch 1: insert parent
        parent_events = [_make_event(organization, "parent")]
        await repository.insert_batch(parent_events)
        await session.flush()

        # Batch 2: insert child referencing parent
        child_events = [
            _make_event(organization, "child", pending_parent_external_id="parent"),
        ]
        event_ids, _ = await repository.insert_batch(child_events)
        resolved = await _resolve(repository, event_ids)

        assert len(resolved) == 1
        by_ext = await _get_events(session, organization)
        child = by_ext["child"]
        parent = by_ext["parent"]

        assert child.parent_id == parent.id
        assert child.root_id == parent.id

    async def test_child_arrives_before_parent_cross_batch(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Child arrives first, stays pending. Parent arrives later, resolves it."""
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        # Batch 1: child arrives, parent doesn't exist yet
        child_events = [
            _make_event(organization, "child", pending_parent_external_id="parent"),
        ]
        child_ids, _ = await repository.insert_batch(child_events)
        resolved = await _resolve(repository, child_ids)
        assert resolved == []
        await session.flush()

        # Verify child is still pending
        by_ext = await _get_events(session, organization)
        assert by_ext["child"].pending_parent_external_id == "parent"
        assert by_ext["child"].parent_id is None
        assert by_ext["child"].root_id is None

        # Batch 2: parent arrives, child should be resolved
        parent_events = [_make_event(organization, "parent")]
        parent_ids, _ = await repository.insert_batch(parent_events)
        resolved = await _resolve(repository, parent_ids)

        assert len(resolved) == 1
        by_ext = await _get_events(session, organization)
        child = by_ext["child"]
        parent = by_ext["parent"]

        assert child.parent_id == parent.id
        assert child.root_id == parent.id
        assert child.pending_parent_external_id is None

    async def test_deep_chain_cross_batch(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """
        OTEL-like scenario: grandchild, child, root arrive in three separate batches.
        grandchild and child stay pending until root arrives.
        """
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        # Batch 1: grandchild (both parent and root missing)
        gc_events = [
            _make_event(organization, "grandchild", pending_parent_external_id="child"),
        ]
        gc_ids, _ = await repository.insert_batch(gc_events)
        resolved = await _resolve(repository, gc_ids)
        assert resolved == []
        await session.flush()

        # Batch 2: child arrives (parent "root" still missing)
        child_events = [
            _make_event(organization, "child", pending_parent_external_id="root"),
        ]
        child_ids, _ = await repository.insert_batch(child_events)
        resolved = await _resolve(repository, child_ids)
        # grandchild can't resolve yet because child is also pending
        assert resolved == []
        await session.flush()

        # Batch 3: root arrives, entire chain should resolve
        root_events = [_make_event(organization, "root")]
        root_ids, _ = await repository.insert_batch(root_events)
        resolved = await _resolve(repository, root_ids)

        assert len(resolved) == 2
        by_ext = await _get_events(session, organization)
        root = by_ext["root"]
        child = by_ext["child"]
        grandchild = by_ext["grandchild"]

        assert child.parent_id == root.id
        assert child.root_id == root.id

        assert grandchild.parent_id == child.id
        assert grandchild.root_id == root.id

    async def test_branching_hierarchy(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """
        Root with two children, each with a grandchild.
        All in one batch, out of order.
        """
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        events = [
            _make_event(organization, "gc1", pending_parent_external_id="child1"),
            _make_event(organization, "gc2", pending_parent_external_id="child2"),
            _make_event(organization, "child2", pending_parent_external_id="root"),
            _make_event(organization, "root"),
            _make_event(organization, "child1", pending_parent_external_id="root"),
        ]
        event_ids, _ = await repository.insert_batch(events)
        resolved = await _resolve(repository, event_ids)

        assert len(resolved) == 4
        by_ext = await _get_events(session, organization)
        root = by_ext["root"]

        for child_ext in ("child1", "child2"):
            child = by_ext[child_ext]
            assert child.parent_id == root.id
            assert child.root_id == root.id

        assert by_ext["gc1"].parent_id == by_ext["child1"].id
        assert by_ext["gc1"].root_id == root.id
        assert by_ext["gc2"].parent_id == by_ext["child2"].id
        assert by_ext["gc2"].root_id == root.id

    async def test_partial_chain_does_not_resolve(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """
        Grandchild is pending on child. Child arrives but is itself pending on
        a missing root. Neither should resolve — the chain doesn't reach a root.
        """
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        # Batch 1: grandchild, parent "child" doesn't exist yet
        gc_events = [
            _make_event(organization, "grandchild", pending_parent_external_id="child"),
        ]
        gc_ids, _ = await repository.insert_batch(gc_events)
        resolved = await _resolve(repository, gc_ids)
        assert resolved == []
        await session.flush()

        # Batch 2: child arrives, but its parent "root" is missing
        child_events = [
            _make_event(organization, "child", pending_parent_external_id="root"),
        ]
        child_ids, _ = await repository.insert_batch(child_events)
        resolved = await _resolve(repository, child_ids)

        assert resolved == []

        by_ext = await _get_events(session, organization)
        assert by_ext["grandchild"].pending_parent_external_id == "child"
        assert by_ext["grandchild"].parent_id is None
        assert by_ext["grandchild"].root_id is None

        assert by_ext["child"].pending_parent_external_id == "root"
        assert by_ext["child"].parent_id is None
        assert by_ext["child"].root_id is None

    async def test_parent_referenced_by_uuid(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Parent referenced by UUID string instead of external_id."""
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        parent_id = uuid.uuid4()
        events = [
            _make_event(
                organization,
                "child",
                pending_parent_external_id=str(parent_id),
            ),
            {
                "id": parent_id,
                "name": "event.parent",
                "source": EventSource.user,
                "organization_id": organization.id,
                "external_id": "parent",
                "root_id": parent_id,
            },
        ]
        event_ids, _ = await repository.insert_batch(events)
        resolved = await _resolve(repository, event_ids)

        assert len(resolved) == 1
        by_ext = await _get_events(session, organization)
        assert by_ext["child"].parent_id == parent_id
        assert by_ext["child"].root_id == parent_id

    async def test_cross_org_isolation(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Events in different orgs with same external_id don't cross-resolve."""
        org1 = await create_organization(save_fixture, account)
        org2 = await create_organization(save_fixture, account_second)
        repository = EventRepository.from_session(session)

        events = [
            _make_event(org1, "child", pending_parent_external_id="parent"),
            _make_event(org2, "parent"),
        ]
        event_ids, _ = await repository.insert_batch(events)
        resolved = await _resolve(repository, event_ids)

        # Should NOT resolve — parent is in a different org
        assert resolved == []
        by_ext_org1 = await _get_events(session, org1)
        assert by_ext_org1["child"].pending_parent_external_id == "parent"
        assert by_ext_org1["child"].parent_id is None
        assert by_ext_org1["child"].root_id is None

    async def test_returns_only_newly_resolved_ids(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Return value contains only the IDs of events that were resolved."""
        organization = await create_organization(save_fixture, account)
        repository = EventRepository.from_session(session)

        events = [
            _make_event(organization, "orphan", pending_parent_external_id="missing"),
            _make_event(organization, "child", pending_parent_external_id="parent"),
            _make_event(organization, "parent"),
            _make_event(organization, "standalone"),
        ]
        event_ids, _ = await repository.insert_batch(events)
        resolved = await _resolve(repository, event_ids)

        by_ext = await _get_events(session, organization)
        # Only child should be resolved
        assert len(resolved) == 1
        assert by_ext["child"].id in resolved

        # Orphan stays pending
        assert by_ext["orphan"].pending_parent_external_id == "missing"
        assert by_ext["orphan"].parent_id is None
        assert by_ext["orphan"].root_id is None

        # Resolved child has correct root_id
        parent = by_ext["parent"]
        child = by_ext["child"]
        assert child.root_id == parent.id

        # Standalone root has root_id == self
        standalone = by_ext["standalone"]
        assert standalone.root_id == standalone.id
