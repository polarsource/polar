import pytest

from polar.auth.models import AuthSubject
from polar.authz.policies import finance as finance_policy
from polar.authz.policies import members
from polar.authz.policies import organization as org_policy
from polar.models import Organization, User
from polar.models.user_organization import OrganizationRole, UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


async def _set_role(
    save_fixture: SaveFixture,
    user_organization: UserOrganization,
    role: OrganizationRole,
) -> None:
    user_organization.role = role
    await save_fixture(user_organization)


@pytest.mark.asyncio
class TestFinanceCanRead:
    @pytest.mark.auth
    async def test_admin_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.admin)

        result = await finance_policy.can_read(session, auth_subject, organization)
        assert result is True

    @pytest.mark.auth
    async def test_owner_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.owner)

        result = await finance_policy.can_read(session, auth_subject, organization)
        assert result is True

    @pytest.mark.auth
    async def test_member_denied(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.member)

        result = await finance_policy.can_read(session, auth_subject, organization)
        assert isinstance(result, str)
        assert "permission" in result.lower()

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_subject_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        result = await finance_policy.can_read(session, auth_subject, organization)
        assert result is True


@pytest.mark.asyncio
class TestOrgCanManage:
    @pytest.mark.auth
    async def test_admin_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.admin)

        result = await org_policy.can_manage(session, auth_subject, organization)
        assert result is True

    @pytest.mark.auth
    async def test_member_denied_with_specific_message(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.member)

        result = await org_policy.can_manage(session, auth_subject, organization)
        assert result == "You don't have permission to manage the organization"


@pytest.mark.asyncio
class TestMembersCanManage:
    @pytest.mark.auth
    async def test_admin_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.admin)

        result = await members.can_manage(session, auth_subject, organization)
        assert result is True

    @pytest.mark.auth
    async def test_member_denied_with_specific_message(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.member)

        result = await members.can_manage(session, auth_subject, organization)
        assert result == "You don't have permission to manage members"
