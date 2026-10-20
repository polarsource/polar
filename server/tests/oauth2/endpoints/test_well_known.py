import pytest
from authlib.oauth2.rfc7523.jwt_bearer import JWT_BEARER_GRANT_TYPE
from httpx import AsyncClient

from polar.auth.scope import SCOPES_SUPPORTED
from polar.config import settings
from polar.oauth2.constants import ISSUER


@pytest.fixture
def agent_sign_up_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AGENT_SIGN_UP_ENABLED", True)


@pytest.mark.anyio
async def test_jwks(client: AsyncClient) -> None:
    response = await client.get("/.well-known/jwks.json")

    assert response.status_code == 200
    json = response.json()

    assert len(json["keys"]) > 0
    for key in json["keys"]:
        assert "kid" in key
        assert "d" not in key


@pytest.mark.anyio
@pytest.mark.parametrize(
    "path",
    [
        "/.well-known/openid-configuration",
        "/.well-known/oauth-authorization-server",
    ],
)
async def test_authorization_server_metadata(client: AsyncClient, path: str) -> None:
    response = await client.get(path)

    assert response.status_code == 200

    json = response.json()
    assert len(json["revocation_endpoint_auth_methods_supported"]) > 0
    assert len(json["introspection_endpoint_auth_methods_supported"]) > 0
    assert len(json["code_challenge_methods_supported"]) > 0
    assert json["authorization_response_iss_parameter_supported"] is True
    assert JWT_BEARER_GRANT_TYPE not in json["grant_types_supported"]


@pytest.mark.anyio
@pytest.mark.usefixtures("agent_sign_up_enabled")
async def test_authorization_server_metadata_agent_sign_up(
    client: AsyncClient,
) -> None:
    response = await client.get("/.well-known/oauth-authorization-server")

    assert response.status_code == 200
    assert JWT_BEARER_GRANT_TYPE in response.json()["grant_types_supported"]


@pytest.mark.anyio
class TestProtectedResourceMetadata:
    async def test_disabled(self, client: AsyncClient) -> None:
        response = await client.get("/.well-known/oauth-protected-resource")

        assert response.status_code == 404

    @pytest.mark.usefixtures("agent_sign_up_enabled")
    async def test_enabled(self, client: AsyncClient) -> None:
        response = await client.get("/.well-known/oauth-protected-resource")

        assert response.status_code == 200
        json = response.json()
        assert json["resource"] == ISSUER
        assert json["authorization_servers"] == [ISSUER]
        assert json["scopes_supported"] == SCOPES_SUPPORTED
        assert json["bearer_methods_supported"] == ["header"]


@pytest.mark.anyio
@pytest.mark.usefixtures("agent_sign_up_enabled")
@pytest.mark.parametrize(
    "headers",
    [
        pytest.param({}, id="no token"),
        pytest.param({"Authorization": "Bearer polar_at_u_invalid"}, id="bad token"),
    ],
)
async def test_unauthorized_points_to_protected_resource_metadata(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    response = await client.get("/v1/oauth2/userinfo", headers=headers)

    assert response.status_code == 401
    assert (
        f'resource_metadata="{ISSUER}/.well-known/oauth-protected-resource"'
        in response.headers["WWW-Authenticate"]
    )
