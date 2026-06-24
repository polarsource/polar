import pytest
from pydantic import UUID4, BaseModel

from polar.auth.models import AuthSubject
from polar.exceptions import PolarRequestValidationError
from polar.models import Organization, User, UserOrganization
from polar.models.user_organization import OrganizationRole
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


class OrganizationIDPayload(BaseModel):
    organization_id: UUID4 | None = None


@pytest.mark.asyncio
class TestGetPayloadOrganization:
    @pytest.mark.auth
    async def test_single_org_down_scope_resolves_implicitly(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        auth_subject.organization_ids = frozenset({organization.id})

        result = await get_payload_organization(
            session, auth_subject, OrganizationIDPayload()
        )

        assert result == organization

    @pytest.mark.auth
    async def test_unrestricted_user_still_requires_organization_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        assert auth_subject.organization_ids is None

        with pytest.raises(PolarRequestValidationError):
            await get_payload_organization(
                session, auth_subject, OrganizationIDPayload()
            )

    @pytest.mark.auth
    async def test_explicit_organization_id_still_validates(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        auth_subject.organization_ids = frozenset({organization.id})

        result = await get_payload_organization(
            session,
            auth_subject,
            OrganizationIDPayload(organization_id=organization.id),
        )

        assert result == organization

    @pytest.mark.auth
    async def test_multi_org_down_scope_requires_organization_id(
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
            UserOrganization(
                user=user,
                organization=organization_second,
                role=OrganizationRole.member,
            )
        )
        auth_subject.organization_ids = frozenset(
            {organization.id, organization_second.id}
        )

        with pytest.raises(PolarRequestValidationError):
            await get_payload_organization(
                session, auth_subject, OrganizationIDPayload()
            )
