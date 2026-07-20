import re
import uuid
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
import pytest_asyncio
import respx
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.models import (
    Organization,
    OrganizationSSOConnection,
    User,
    UserOrganization,
)
from polar.models.organization_sso_connection import (
    OIDCAuthMethod,
    OIDCConfiguration,
    OrganizationSSOConnectionType,
)
from polar.sso.discovery import DISCOVERY_PATH
from polar.sso.schemas import RESERVED_AUTHORIZATION_PARAMETERS
from tests.fixtures.database import SaveFixture

DISCOVERY_ROUTE = re.compile(rf".*{re.escape(DISCOVERY_PATH)}$")


def discovery_document(issuer: str, **overrides: Any) -> dict[str, Any]:
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/authorize",
        "token_endpoint": f"{issuer}/token",
        "jwks_uri": f"{issuer}/jwks",
        "id_token_signing_alg_values_supported": ["RS256"],
        "token_endpoint_auth_methods_supported": ["client_secret_post"],
        **overrides,
    }


@pytest.fixture(autouse=True)
def discovery_mock(mocker: MockerFixture) -> Iterator[respx.MockRouter]:
    mocker.patch("polar.sso.discovery.resolve_and_validate_ip")

    def respond(request: httpx.Request) -> httpx.Response:
        issuer = str(request.url).removesuffix(DISCOVERY_PATH)
        return httpx.Response(200, json=discovery_document(issuer))

    with respx.mock(assert_all_mocked=False, assert_all_called=False) as mock:
        mock.get(url__regex=DISCOVERY_ROUTE).mock(side_effect=respond)
        yield mock


async def create_sso_connection(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    name: str | None = None,
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
        name=name,
        type=OrganizationSSOConnectionType.oidc,
        configuration=configuration,
        enabled=enabled,
    )
    await save_fixture(connection)
    return connection


@pytest_asyncio.fixture
async def sso_enabled_organization(
    save_fixture: SaveFixture, organization: Organization
) -> Organization:
    organization.feature_settings = {
        **organization.feature_settings,
        "sso_enabled": True,
    }
    await save_fixture(organization)
    return organization


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
        sso_enabled_organization: Organization,
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
        sso_enabled_organization: Organization,
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
        sso_enabled_organization: Organization,
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
        sso_enabled_organization: Organization,
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
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
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
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                }
            },
        )
        assert response.status_code == 422

    @pytest.mark.auth
    @pytest.mark.parametrize("suffix", [DISCOVERY_PATH, f"{DISCOVERY_PATH}/", "/"])
    async def test_issuer_pasted_as_discovery_url(
        self,
        suffix: str,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": f"https://idp.example.com{suffix}",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 201
        assert response.json()["configuration"]["issuer"] == "https://idp.example.com/"

    @pytest.mark.auth
    async def test_authorization_parameters(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                    "authorization_parameters": {"hd": "polar.sh"},
                }
            },
        )
        assert response.status_code == 201
        assert response.json()["configuration"]["authorization_parameters"] == {
            "hd": "polar.sh"
        }

    @pytest.mark.auth
    @pytest.mark.parametrize("key", sorted(RESERVED_AUTHORIZATION_PARAMETERS))
    async def test_reserved_authorization_parameter(
        self,
        key: str,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                    "authorization_parameters": {key: "attacker-controlled"},
                }
            },
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_too_many_authorization_parameters(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                    "authorization_parameters": {
                        f"param_{index}": "value" for index in range(11)
                    },
                }
            },
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_unreachable_discovery_document(
        self,
        client: AsyncClient,
        discovery_mock: respx.MockRouter,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        discovery_mock.get(url__regex=DISCOVERY_ROUTE).mock(
            side_effect=httpx.ConnectError("nope")
        )
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == [
            "body",
            "configuration",
            "issuer",
        ]

    @pytest.mark.auth
    async def test_discovery_document_not_found(
        self,
        client: AsyncClient,
        discovery_mock: respx.MockRouter,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        discovery_mock.get(url__regex=DISCOVERY_ROUTE).mock(
            return_value=httpx.Response(404)
        )
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_issuer_mismatch(
        self,
        client: AsyncClient,
        discovery_mock: respx.MockRouter,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        discovery_mock.get(url__regex=DISCOVERY_ROUTE).mock(
            return_value=httpx.Response(
                200, json=discovery_document("https://other.example.com")
            )
        )
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 422
        assert "https://other.example.com" in response.json()["detail"][0]["msg"]

    @pytest.mark.auth
    async def test_missing_required_metadata(
        self,
        client: AsyncClient,
        discovery_mock: respx.MockRouter,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        document = discovery_document("https://idp.example.com")
        del document["jwks_uri"]
        discovery_mock.get(url__regex=DISCOVERY_ROUTE).mock(
            return_value=httpx.Response(200, json=document)
        )
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 422
        assert "jwks_uri" in response.json()["detail"][0]["msg"]

    @pytest.mark.auth
    async def test_private_key_jwt_not_supported(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "private_key_jwt",
                }
            },
        )
        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == [
            "body",
            "configuration",
            "auth_method",
        ]

    @pytest.mark.auth
    async def test_private_key_jwt_supported(
        self,
        client: AsyncClient,
        discovery_mock: respx.MockRouter,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        discovery_mock.get(url__regex=DISCOVERY_ROUTE).mock(
            return_value=httpx.Response(
                200,
                json=discovery_document(
                    "https://idp.example.com",
                    token_endpoint_auth_methods_supported=["private_key_jwt"],
                ),
            )
        )
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "private_key_jwt",
                }
            },
        )
        assert response.status_code == 201

    @pytest.mark.auth
    async def test_non_https_issuer(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
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
        sso_enabled_organization: Organization,
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
        sso_enabled_organization: Organization,
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
    async def test_configuration(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={
                "configuration": {
                    "issuer": "https://new-idp.example.com",
                    "client_id": "new-client-id",
                    "auth_method": "client_secret",
                    "client_secret": "new-secret",
                }
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert json["configuration"]["issuer"] == "https://new-idp.example.com/"
        assert json["configuration"]["client_id"] == "new-client-id"
        assert "client_secret" not in json["configuration"]

    @pytest.mark.auth
    async def test_configuration_client_secret_required(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={
                "configuration": {
                    "issuer": "https://new-idp.example.com",
                    "client_id": "new-client-id",
                    "auth_method": "client_secret",
                }
            },
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_rename_is_not_validated(
        self,
        client: AsyncClient,
        discovery_mock: respx.MockRouter,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={"name": "New name"},
        )
        assert response.status_code == 200
        assert not discovery_mock.calls

    @pytest.mark.auth
    async def test_enabling_is_validated(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        discovery_mock: respx.MockRouter,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        connection = await create_sso_connection(
            save_fixture, organization, enabled=False
        )
        discovery_mock.get(url__regex=DISCOVERY_ROUTE).mock(
            return_value=httpx.Response(
                200, json=discovery_document("https://other.example.com")
            )
        )
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{connection.id}",
            json={"enabled": True},
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_set_name(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        connection = await create_sso_connection(
            save_fixture, organization, name="Acme SSO"
        )
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{connection.id}",
            json={"name": "New name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New name"

    @pytest.mark.auth
    async def test_clear_name_with_null(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        connection = await create_sso_connection(
            save_fixture, organization, name="Acme SSO"
        )
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{connection.id}",
            json={"name": None},
        )
        assert response.status_code == 200
        assert response.json()["name"] is None

    @pytest.mark.auth
    async def test_clear_name_with_empty_string(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        connection = await create_sso_connection(
            save_fixture, organization, name="Acme SSO"
        )
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{connection.id}",
            json={"name": ""},
        )
        assert response.status_code == 200
        assert response.json()["name"] is None

    @pytest.mark.auth
    async def test_name_preserved_when_not_provided(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        connection = await create_sso_connection(
            save_fixture, organization, name="Acme SSO"
        )
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{connection.id}",
            json={"enabled": False},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Acme SSO"

    @pytest.mark.auth
    async def test_null_configuration_is_ignored(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={"name": "Acme SSO", "configuration": None},
        )
        assert response.status_code == 200
        json = response.json()
        assert json["name"] == "Acme SSO"
        assert json["configuration"]["issuer"] == "https://idp.example.com"

    @pytest.mark.auth
    async def test_null_enabled_is_ignored(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={"enabled": None},
        )
        assert response.status_code == 200
        assert response.json()["enabled"] is True

    @pytest.mark.auth
    async def test_not_existing(
        self,
        client: AsyncClient,
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{uuid.uuid4()}",
            json={"enabled": False},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_disable_last_connection_rejected_when_enforced(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        organization.sso_enforced = True
        await save_fixture(organization)
        auth_subject.organization_ids = frozenset({organization.id})

        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={"enabled": False},
        )

        assert response.status_code == 409

    @pytest.mark.auth
    async def test_disable_connection_allowed_when_another_enabled(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        await create_sso_connection(save_fixture, organization)
        organization.sso_enforced = True
        await save_fixture(organization)
        auth_subject.organization_ids = frozenset({organization.id})

        response = await client.patch(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}",
            json={"enabled": False},
        )

        assert response.status_code == 200


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
        sso_enabled_organization: Organization,
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
        sso_enabled_organization: Organization,
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
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.delete(
            f"/v1/organizations/{organization.id}/sso-connections/{uuid.uuid4()}"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_delete_last_connection_rejected_when_enforced(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        sso_enabled_organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        organization.sso_enforced = True
        await save_fixture(organization)
        auth_subject.organization_ids = frozenset({organization.id})

        response = await client.delete(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}"
        )

        assert response.status_code == 409


@pytest.mark.asyncio
class TestFeatureGate:
    """A member of an organization without the `sso_enabled` feature is denied."""

    @pytest.mark.auth
    async def test_list_denied(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/"
        )
        assert response.status_code == 403

    @pytest.mark.auth
    async def test_create_denied(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/sso-connections/",
            json={
                "configuration": {
                    "issuer": "https://idp.example.com",
                    "client_id": "client-id",
                    "auth_method": "client_secret",
                    "client_secret": "secret",
                }
            },
        )
        assert response.status_code == 403

    @pytest.mark.auth
    async def test_get_denied(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        sso_connection: OrganizationSSOConnection,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/sso-connections/{sso_connection.id}"
        )
        assert response.status_code == 403
