import pytest

from polar.models import Organization, User, UserOrganization
from polar.models.user_organization import OrganizationRole
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestGetOwnerUser:
    async def test_excludes_soft_deleted_membership(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        # Owner A + Admin B.
        owner_membership = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
        )
        await save_fixture(owner_membership)

        admin_membership = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.admin,
        )
        await save_fixture(admin_membership)

        # Soft-delete the owner via raw `remove_member` (allowed because
        # admin B keeps the admin-capability invariant satisfied).
        await user_organization_service.remove_member(
            session,
            user_id=user.id,
            organization_id=organization.id,
        )
        await session.flush()

        repo = OrganizationRepository.from_session(session)
        owner_after_removal = await repo.get_owner_user(organization)
        assert owner_after_removal is None
