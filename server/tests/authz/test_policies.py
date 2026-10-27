import pytest

from polar.auth.models import AuthSubject
from polar.authz.policies import finance as finance_policy
from polar.authz.policies import members
from polar.authz.policies import organization as org_policy
from polar.kit.utils import utc_now
from polar.models import Agent, Organization, User
from polar.models.agent import AgentStatus
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


@pytest.mark.anyio
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

    @pytest.mark.auth
    async def test_finance_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.finance)

        result = await finance_policy.can_read(session, auth_subject, organization)
        assert result is True

    @pytest.mark.auth
    async def test_finance_cannot_manage(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.finance)

        result = await finance_policy.can_manage(session, auth_subject, organization)
        assert result == "You don't have permission to manage financial data"

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


@pytest.mark.anyio
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

    @pytest.mark.auth
    async def test_finance_denied(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.finance)

        result = await org_policy.can_manage(session, auth_subject, organization)
        assert result == "You don't have permission to manage the organization"

    @pytest.mark.auth(AuthSubjectFixture(subject="agent"))
    async def test_agent_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Agent],
        organization: Organization,
    ) -> None:
        result = await org_policy.can_manage(session, auth_subject, organization)
        assert result is True

    @pytest.mark.auth(AuthSubjectFixture(subject="agent"))
    async def test_agent_other_organization_denied(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Agent],
        organization_second: Organization,
    ) -> None:
        result = await org_policy.can_manage(session, auth_subject, organization_second)
        assert result == "You don't have permission to manage the organization"

    @pytest.mark.auth(AuthSubjectFixture(subject="agent"))
    async def test_claimed_agent_denied(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Agent],
        organization: Organization,
        user: User,
    ) -> None:
        agent = auth_subject.subject
        agent.status = AgentStatus.claimed
        agent.claimed_at = utc_now()
        agent.claimed_by_user = user
        await session.flush()

        result = await org_policy.can_manage(session, auth_subject, organization)
        assert result == "You don't have permission to manage the organization"


@pytest.mark.anyio
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

    @pytest.mark.auth
    async def test_finance_denied(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await _set_role(save_fixture, user_organization, OrganizationRole.finance)

        result = await members.can_manage(session, auth_subject, organization)
        assert result == "You don't have permission to manage members"

    @pytest.mark.auth(AuthSubjectFixture(subject="agent"))
    async def test_agent_denied(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Agent],
        organization: Organization,
    ) -> None:
        result = await members.can_manage(session, auth_subject, organization)
        assert result == "You don't have permission to manage members"
