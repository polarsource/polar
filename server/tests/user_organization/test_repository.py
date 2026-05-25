from typing import Any

import pytest

from polar.models import Organization, User, UserOrganization
from polar.models.organization import OrganizationStatus
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
