import pytest

from polar.auth.models import Anonymous, AuthSubject
from polar.external_organization.service import (
    external_organization as external_organization_service,
)
from polar.kit.pagination import PaginationParams
from polar.models import ExternalOrganization, User
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestList:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="anonymous"),
        AuthSubjectFixture(subject="user"),
    )
    async def test_anonymous_user(
        self,
        auth_subject: AuthSubject[Anonymous | User],
        session: AsyncSession,
        external_organization: ExternalOrganization,
        external_organization_linked: ExternalOrganization,
    ) -> None:
        results, count = await external_organization_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 2

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Anonymous | User],
        session: AsyncSession,
        external_organization: ExternalOrganization,
        external_organization_linked: ExternalOrganization,
    ) -> None:
        results, count = await external_organization_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert results[0].id == external_organization_linked.id
