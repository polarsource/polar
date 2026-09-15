import pytest
from sqlalchemy import text

from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.void.identity.repository import IdentityRepository
from polar.void.identity.schemas import Identity, IdentityCreate
from polar.void.identity.service import IdentityHierarchyConflict
from polar.void.identity.service import identity as identity_service
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestTraversal:
    async def test_traversals_and_eager_parents(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        root, _ = await identity_service.ensure(
            session, organization, IdentityCreate(external_id="root")
        )
        child, _ = await identity_service.ensure(
            session,
            organization,
            IdentityCreate(external_id="child", parent_external_id="root"),
        )
        leaf, _ = await identity_service.ensure(
            session,
            organization,
            IdentityCreate(external_id="leaf", parent_external_id="child"),
        )
        await identity_service.ensure(
            session, organization_second, IdentityCreate(external_id="root")
        )
        session.expunge_all()
        fetched = await identity_service.get(session, organization.id, "leaf")
        assert Identity.model_validate(fetched).parent_external_id == "child"
        assert [node.id for node in await identity_service.chain(session, fetched)] == [
            leaf.id,
            child.id,
            root.id,
        ]
        assert (await identity_service.root_of(session, fetched)).id == root.id
        assert [node.id for node in await identity_service.subtree(session, root)] == [
            root.id,
            child.id,
            leaf.id,
        ]
        assert await identity_service.roots_of(
            session, organization.id, ["leaf", "child", "root", "missing"]
        ) == {"leaf": "root", "child": "root", "root": "root"}
        assert await identity_service.roots_of(session, organization.id, []) == {}
        assert (
            await identity_service.roots_of(session, organization_second.id, ["leaf"])
            == {}
        )

    async def test_deleted_ancestor_does_not_become_root(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        root, _ = await identity_service.ensure(
            session, organization, IdentityCreate(external_id="root")
        )
        child, _ = await identity_service.ensure(
            session,
            organization,
            IdentityCreate(external_id="child", parent_external_id="root"),
        )
        leaf, _ = await identity_service.ensure(
            session,
            organization,
            IdentityCreate(external_id="leaf", parent_external_id="child"),
        )
        child.deleted_at = utc_now()
        await save_fixture(child)
        session.expunge_all()
        fetched = await identity_service.get(session, organization.id, "leaf")
        assert fetched.parent_external_id is None
        assert await identity_service.children(session, root) == []
        assert [node.id for node in await identity_service.subtree(session, root)] == [
            root.id
        ]
        assert await identity_service.roots_of(
            session, organization.id, ["leaf", "child", "root"]
        ) == {"root": "root"}
        with pytest.raises(IdentityHierarchyConflict):
            await identity_service.root_of(session, leaf)
        with pytest.raises(ResourceNotFound):
            await identity_service.get(session, organization.id, "child")
        deleted = await IdentityRepository.from_session(session).get_by_external_id(
            organization.id, "child", include_deleted=True
        )
        assert deleted is not None
        assert deleted.deleted_at is not None

    async def test_corrupt_cycle_terminates(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        root, _ = await identity_service.ensure(
            session, organization, IdentityCreate(external_id="root")
        )
        child, _ = await identity_service.ensure(
            session,
            organization,
            IdentityCreate(external_id="child", parent_external_id="root"),
        )
        await session.execute(text("SET LOCAL statement_timeout = 5000"))
        root.parent_id = child.id
        await save_fixture(root)
        with pytest.raises(IdentityHierarchyConflict):
            await identity_service.chain(session, child)
        assert {node.id for node in await identity_service.subtree(session, root)} == {
            root.id,
            child.id,
        }
        assert (
            await identity_service.roots_of(session, organization.id, ["child", "root"])
            == {}
        )
