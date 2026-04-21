import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids
from polar.models import Organization, User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


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
