import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import Organization, OrganizationSSOConnection, UserOrganization
from polar.models.organization_sso_connection import (
    OIDCAuthMethod,
    OIDCConfiguration,
    OrganizationSSOConnectionType,
)
from tests.fixtures.database import SaveFixture


async def create_sso_connection(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    auth_method: OIDCAuthMethod = OIDCAuthMethod.client_secret,
    client_secret: str | None = "secret",
    enabled: bool = True,
) -> OrganizationSSOConnection:
    configuration: OIDCConfiguration = {
        "issuer": "https://idp.example.com",
        "client_id": "client-id",
        "auth_method": auth_method,
    }
    if client_secret is not None:
        configuration["client_secret"] = client_secret
    connection = OrganizationSSOConnection(
        organization=organization,
        type=OrganizationSSOConnectionType.oidc,
        configuration=configuration,
        enabled=enabled,
    )
    await save_fixture(connection)
    return connection


@pytest_asyncio.fixture
async def sso_connection(
    save_fixture: SaveFixture, organization: Organization
) -> OrganizationSSOConnection:
    return await create_sso_connection(save_fixture, organization)


@pytest.mark.asyncio
class TestListSSOConnections:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/"
        )
        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        item = json["items"][0]
        assert item["id"] == str(sso_connection.id)
        assert "client_secret" not in item["configuration"]


@pytest.mark.asyncio
class TestGetSSOConnection:
    async def test_anonymous(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}"
        )
        assert response.status_code == 200
        assert response.json()["id"] == str(sso_connection.id)

    @pytest.mark.auth
    async def test_not_existing(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/{uuid.uuid4()}"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_other_organization_connection(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        other = await create_sso_connection(save_fixture, organization_second)
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/{other.id}"
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestCreateSSOConnection:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "type": "oidc",
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "type": "oidc",
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "type": "oidc",
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 201

        json = response.json()
        assert json["type"] == "oidc"
        assert json["enabled"] is False
        assert "client_secret" not in json["configuration"]

    @pytest.mark.auth
    async def test_client_secret_required(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "type": "oidc",
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                }
            },
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_non_https_issuer(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "type": "oidc",
                    "issuer": "http://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestUpdateSSOConnection:
    async def test_anonymous(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={"enabled": False},
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={"enabled": False},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_other_organization_connection(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        other = await create_sso_connection(save_fixture, organization_second)
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{other.id}",
            json={"enabled": False},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={"enabled": False},
        )
        assert response.status_code == 200
        assert response.json()["enabled"] is False

    @pytest.mark.auth
    async def test_not_existing(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{uuid.uuid4()}",
            json={"enabled": False},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestDeleteSSOConnection:
    async def test_anonymous(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.delete(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.delete(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_other_organization_connection(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        other = await create_sso_connection(save_fixture, organization_second)
        response = await client.delete(
            f"/v1/organizations/{organization.id}/sso-connections/{other.id}"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.delete(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}"
        )
        assert response.status_code == 204

        get_response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}"
        )
        assert get_response.status_code == 404

    @pytest.mark.auth
    async def test_not_existing(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.delete(
            f"/v1/organizations/{organization.id}/sso-connections/{uuid.uuid4()}"
        )
        assert response.status_code == 404
