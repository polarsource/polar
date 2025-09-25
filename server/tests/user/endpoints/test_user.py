import pytest
from httpx import AsyncClient

from polar.models.user import User


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_users_me_authed(user: User, client: AsyncClient) -> None:
    response = await client.get("/v1/users/me")

    assert response.status_code == 200
    json = response.json()

    assert json["email"] == user.email
    assert "oauth_accounts" in json


@pytest.mark.asyncio
async def test_get_users_me_no_auth(client: AsyncClient) -> None:
    response = await client.get(
        "/v1/users/me",
    )

    assert response.status_code == 401
