from uuid import UUID

import pytest

from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids, get_accessible_organization
from polar.models import Organization, User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture

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
