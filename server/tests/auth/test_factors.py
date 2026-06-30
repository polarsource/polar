import pytest

from polar.auth.factors import get_org_factors
from polar.auth.oauth2.state import OAuth2StateService
from polar.exceptions import ResourceNotFound
from polar.models import Organization, OrganizationSSOConnection
from polar.models.organization_sso_connection import (
    OIDCAuthMethod,
    OIDCConfiguration,
    OrganizationSSOConnectionType,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def create_sso_connection(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    enabled: bool,
) -> OrganizationSSOConnection:
    configuration: OIDCConfiguration = {
        "issuer": "https://idp.example.com",
        "client_id": "client-id",
        "auth_method": OIDCAuthMethod.client_secret,
        "client_secret": "secret",
    }
    connection = OrganizationSSOConnection(
        organization=organization,
        type=OrganizationSSOConnectionType.oidc,
        configuration=configuration,
        enabled=enabled,
    )
    await save_fixture(connection)
    return connection


@pytest.mark.asyncio
class TestGetOrgFactors:
    async def test_unknown_slug(self, session: AsyncSession) -> None:
        with pytest.raises(ResourceNotFound):
            await get_org_factors(
                slug="does-not-exist",
                base_factors=set(),
                session=session,
                state_service=OAuth2StateService(session),
            )

    async def test_only_enabled_connections_become_factors(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        enabled = await create_sso_connection(save_fixture, organization, enabled=True)
        await create_sso_connection(save_fixture, organization, enabled=False)

        factors = await get_org_factors(
            slug=organization.slug,
            base_factors=set(),
            session=session,
            state_service=OAuth2StateService(session),
        )

        assert {factor.identifier for factor in factors} == {str(enabled.id)}
