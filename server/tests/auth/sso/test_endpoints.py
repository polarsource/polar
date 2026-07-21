import uuid

import pytest
from httpx import AsyncClient

from polar.auth.sso.endpoints import get_sso_connection
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
    name: str | None = None,
) -> OrganizationSSOConnection:
    configuration: OIDCConfiguration = {
        "issuer": "https://idp.example.com",
        "client_id": "client-id",
        "auth_method": OIDCAuthMethod.client_secret,
        "client_secret": "secret",
    }
    organization.feature_settings = {
        **organization.feature_settings,
        "sso_enabled": True,
    }
    await save_fixture(organization)
    connection = OrganizationSSOConnection(
        organization=organization,
        type=OrganizationSSOConnectionType.oidc,
        configuration=configuration,
        enabled=enabled,
        name=name,
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


@pytest.mark.asyncio
class TestStart:
    async def test_unknown_slug(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/does-not-exist/start", json={})
        assert response.status_code == 404

    async def test_exposes_enabled_sso_connections(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        enabled = await create_sso_connection(
            save_fixture, organization, name="Acme SSO"
        )
        await create_sso_connection(save_fixture, organization, enabled=False)

        response = await client.post(f"/v1/auth/{organization.slug}/start", json={})

        assert response.status_code == 201
        sso_factors = [
            factor
            for factor in response.json()["available_factors"]
            if factor["type"] == "sso"
        ]
        assert [factor["connection_id"] for factor in sso_factors] == [str(enabled.id)]
        assert sso_factors[0]["name"] == "Acme SSO"
