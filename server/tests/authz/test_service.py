from unittest.mock import MagicMock
from uuid import UUID

import pytest

from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids, get_accessible_organization
from polar.models import Organization, PersonalAccessToken, User
from polar.models.organization import OrganizationStatus
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture

NONEXISTENT_ORG_ID = UUID("00000000-0000-0000-0000-000000000000")


@pytest.mark.asyncio
class TestGetAccessibleOrganization:
    @pytest.mark.auth
    async def test_user_with_no_orgs(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        result = await get_accessible_organization(
            session, auth_subject, organization.id
        )
        assert result is None

    @pytest.mark.auth
    async def test_user_with_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        result = await get_accessible_organization(
            session, auth_subject, organization.id
        )
        assert result is not None
        assert result.id == organization.id

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_subject(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        result = await get_accessible_organization(
            session, auth_subject, organization.id
        )
        assert result is not None
        assert result.id == organization.id

    @pytest.mark.auth
    async def test_nonexistent_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
    ) -> None:
        result = await get_accessible_organization(
            session, auth_subject, NONEXISTENT_ORG_ID
        )
        assert result is None


@pytest.mark.asyncio
class TestGetAccessibleOrgIds:
    @pytest.mark.auth
    async def test_user_with_no_orgs(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
    ) -> None:
        result = await get_accessible_org_ids(session, auth_subject)
        assert result == set()

    @pytest.mark.auth
    async def test_user_with_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        result = await get_accessible_org_ids(session, auth_subject)
        assert result == {organization.id}

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_subject(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        result = await get_accessible_org_ids(session, auth_subject)
        assert result == {organization.id}

    @pytest.mark.auth
    async def test_excludes_soft_deleted_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.set_deleted_at()
        await session.flush()

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == set()

    @pytest.mark.auth
    async def test_excludes_blocked_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.set_status(OrganizationStatus.BLOCKED)
        await session.flush()

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == set()


@pytest.mark.asyncio
class TestGetAccessibleOrgIdsSSOEnforced:
    """A non-SSO user session cannot reach organizations that enforce SSO."""

    @pytest.mark.auth
    async def test_global_session_denied_enforced_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.sso_enforced = True
        await session.flush()

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == set()

    @pytest.mark.auth
    async def test_global_session_allowed_non_enforced_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.sso_enforced = False
        await session.flush()

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == {organization.id}

    @pytest.mark.auth
    async def test_sso_scoped_session_allowed_enforced_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.sso_enforced = True
        await session.flush()
        auth_subject.organization_ids = frozenset({organization.id})

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == {organization.id}

    @pytest.mark.auth
    async def test_token_credential_exempt(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.sso_enforced = True
        await session.flush()
        # PAT / OAuth credentials are not user sessions and stay exempt.
        auth_subject.session = MagicMock(spec=PersonalAccessToken)

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == {organization.id}


@pytest.mark.asyncio
class TestGetAccessibleOrgIdsScopedTo:
    """`AuthSubject.organization_ids` down-scopes the accessible set."""

    @pytest.mark.auth
    async def test_none_is_unrestricted(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await save_fixture(
            UserOrganization(user=user, organization=organization_second)
        )
        auth_subject.organization_ids = None

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == {organization.id, organization_second.id}

    @pytest.mark.auth
    async def test_scopes_to_subset(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await save_fixture(
            UserOrganization(user=user, organization=organization_second)
        )
        auth_subject.organization_ids = frozenset({organization.id})

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == {organization.id}

    @pytest.mark.auth
    async def test_intersects_with_membership(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Scoped to an org the user is not a member of: membership is the floor.
        auth_subject.organization_ids = frozenset({NONEXISTENT_ORG_ID})

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == set()

    @pytest.mark.auth
    async def test_empty_scope_grants_nothing(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # An explicit empty set restricts to nothing (distinct from None).
        auth_subject.organization_ids = frozenset()

        result = await get_accessible_org_ids(session, auth_subject)
        assert result == set()


@pytest.mark.asyncio
class TestGetAccessibleOrganizationScopedTo:
    @pytest.mark.auth
    async def test_returned_when_in_scope(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        auth_subject.organization_ids = frozenset({organization.id})

        result = await get_accessible_organization(
            session, auth_subject, organization.id
        )
        assert result is not None
        assert result.id == organization.id

    @pytest.mark.auth
    async def test_excluded_when_out_of_scope(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        auth_subject.organization_ids = frozenset({NONEXISTENT_ORG_ID})

        result = await get_accessible_organization(
            session, auth_subject, organization.id
        )
        assert result is None
