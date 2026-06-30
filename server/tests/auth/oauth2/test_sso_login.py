import uuid

import pytest

from polar.auth.oauth2.sso_login import get_sso_connection
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
    enabled: bool = True,
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
class TestGetSSOConnection:
    async def test_unknown_slug(self, session: AsyncSession) -> None:
        with pytest.raises(ResourceNotFound):
            await get_sso_connection(
                slug="does-not-exist", connection_id=uuid.uuid4(), session=session
            )

    async def test_unknown_connection(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        with pytest.raises(ResourceNotFound):
            await get_sso_connection(
                slug=organization.slug,
                connection_id=uuid.uuid4(),
                session=session,
            )

    async def test_disabled_connection(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        connection = await create_sso_connection(
            save_fixture, organization, enabled=False
        )
        with pytest.raises(ResourceNotFound):
            await get_sso_connection(
                slug=organization.slug, connection_id=connection.id, session=session
            )

    async def test_connection_from_another_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        connection = await create_sso_connection(save_fixture, organization_second)
        with pytest.raises(ResourceNotFound):
            await get_sso_connection(
                slug=organization.slug, connection_id=connection.id, session=session
            )

    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        connection = await create_sso_connection(save_fixture, organization)

        result = await get_sso_connection(
            slug=organization.slug, connection_id=connection.id, session=session
        )

        assert result.id == connection.id
