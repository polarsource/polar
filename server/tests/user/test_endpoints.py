import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.user import User


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_users_me_authed(
    user: User, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        "/api/v1/users/me",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    json = response.json()

    assert json["email"] == user.email
    assert "oauth_accounts" in json


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_users_me_no_auth(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/users/me",
    )

    assert response.status_code == 401
