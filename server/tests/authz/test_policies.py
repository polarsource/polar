import pytest

from polar.auth.models import AuthSubject
from polar.authz.policies import finance, members
from polar.authz.policies import organization as org_policy
from polar.models import Organization, User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account


@pytest.mark.asyncio
class TestFinanceCanRead:
    @pytest.mark.auth
    async def test_admin_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.account = await create_account(save_fixture, user=user)
        await save_fixture(organization)

        result = await finance.can_read(session, auth_subject, organization)
        assert result is True

    @pytest.mark.auth
    async def test_non_admin_denied_with_message(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        other_user = User(email="admin@example.com")
        await save_fixture(other_user)
        organization.account = await create_account(save_fixture, user=other_user)
        await save_fixture(organization)

        result = await finance.can_read(session, auth_subject, organization)
        assert isinstance(result, str)
        assert "admin" in result.lower()

    @pytest.mark.auth
    async def test_no_account_denied(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        object.__setattr__(organization, "account_id", None)

        result = await finance.can_read(session, auth_subject, organization)
        assert isinstance(result, str)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_subject_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        result = await finance.can_read(session, auth_subject, organization)
        assert result is True


@pytest.mark.asyncio
class TestOrgCanDelete:
    @pytest.mark.auth
    async def test_admin_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.account = await create_account(save_fixture, user=user)
        await save_fixture(organization)

        result = await org_policy.can_delete(session, auth_subject, organization)
        assert result is True

    @pytest.mark.auth
    async def test_non_admin_denied_with_specific_message(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        other_user = User(email="admin@example.com")
        await save_fixture(other_user)
        organization.account = await create_account(save_fixture, user=other_user)
        await save_fixture(organization)

        result = await org_policy.can_delete(session, auth_subject, organization)
        assert isinstance(result, str)
        assert (
            result
            == "Only the account admin can delete an organization with an account"
        )


@pytest.mark.asyncio
class TestMembersCanManage:
    @pytest.mark.auth
    async def test_admin_allowed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.account = await create_account(save_fixture, user=user)
        await save_fixture(organization)

        result = await members.can_manage(session, auth_subject, organization)
        assert result is True

    @pytest.mark.auth
    async def test_non_admin_denied_with_specific_message(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        other_user = User(email="admin@example.com")
        await save_fixture(other_user)
        organization.account = await create_account(save_fixture, user=other_user)
        await save_fixture(organization)

        result = await members.can_manage(session, auth_subject, organization)
        assert isinstance(result, str)
        assert result == "Only organization admins can manage members"
