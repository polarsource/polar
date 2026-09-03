import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_jwks(client: AsyncClient) -> None:
    response = await client.get("/.well-known/jwks.json")

    assert response.status_code == 200
    json = response.json()

    assert len(json["keys"]) > 0
    for key in json["keys"]:
        assert "kid" in key
        assert "d" not in key


@pytest.mark.asyncio
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
