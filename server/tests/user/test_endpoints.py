from datetime import datetime

import pytest
from httpx import AsyncClient

from polar.app import app
from polar.config import settings
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_get_users_me_authed(
    user: User,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/users/me",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["email"] == user.email


@pytest.mark.asyncio
async def test_get_users_me_no_auth() -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/users/me",
        )

    assert response.status_code == 401
