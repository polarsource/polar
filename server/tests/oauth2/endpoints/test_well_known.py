import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_jwks(client: AsyncClient) -> None:
    response = await client.get("/.well-known/jwks.json")

    assert response.status_code == 200
    json = response.json()

    assert len(json["keys"]) > 0
    for key in json["keys"]:
        assert "kid" in key
        assert "d" not in key


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_openid_configuration(client: AsyncClient) -> None:
    response = await client.get("/.well-known/openid-configuration")

    assert response.status_code == 200
