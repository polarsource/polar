from typing import Any

import pytest
from sqlalchemy import select

from polar.models import Account, Organization, User, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.models.user_organization import OrganizationRole
from polar.user_organization.repository import UserOrganizationRepository
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestGetOrganizationsWithRole:
    async def test_returns_active_org(
        self,
        session: Any,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        repository = UserOrganizationRepository.from_session(session)
        result = await repository.get_organizations_with_role(user.id)

        assert len(result) == 1

    async def test_excludes_blocked_org(
        self,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # Block the org the user is a member of. The frontend uses this
        # list to pick redirect targets; blocked orgs would otherwise be
        # selected and 404 at `GET /v1/organizations/?slug=...`.
        organization.set_status(OrganizationStatus.BLOCKED)
        await save_fixture(organization)

        repository = UserOrganizationRepository.from_session(session)
        result = await repository.get_organizations_with_role(user.id)

        assert result == []

    async def test_excludes_soft_deleted_membership(
        self,
        session: Any,
        user_second: User,
        user_organization_second: UserOrganization,
    ) -> None:
        from polar.kit.utils import utc_now

        user_organization_second.deleted_at = utc_now()
        await session.flush()

        repository = UserOrganizationRepository.from_session(session)
        result = await repository.get_organizations_with_role(user_second.id)

        assert result == []


@pytest.mark.asyncio
class TestPromoteToOwner:
    async def test_promotes_live_member(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user_second: User,
    ) -> None:
        relation = UserOrganization(
            user_id=user_second.id, organization_id=organization.id
        )
        await save_fixture(relation)

        repository = UserOrganizationRepository.from_session(session)
        promoted = await repository.promote_to_owner(organization.id, user_second.id)

        assert promoted == user_second.id

        result = await session.execute(
            select(UserOrganization.role).where(
                UserOrganization.user_id == user_second.id,
                UserOrganization.organization_id == organization.id,
            )
        )
        assert result.scalar_one() == OrganizationRole.owner

    async def test_refuses_soft_deleted_member(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user_second: User,
    ) -> None:
        from polar.kit.utils import utc_now

        relation = UserOrganization(
            user_id=user_second.id, organization_id=organization.id
        )
        await save_fixture(relation)

        relation.deleted_at = utc_now()
        await session.flush()

        repository = UserOrganizationRepository.from_session(session)
        promoted = await repository.promote_to_owner(organization.id, user_second.id)

        # No live row was promoted.
        assert promoted is None

        result = await session.execute(
            select(UserOrganization.role).where(
                UserOrganization.user_id == user_second.id,
                UserOrganization.organization_id == organization.id,
            )
        )
        # `role='owner'` was NOT stamped onto the soft-deleted row.
        assert result.scalar_one() == OrganizationRole.member
