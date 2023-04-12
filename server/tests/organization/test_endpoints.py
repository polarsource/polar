from datetime import datetime
from httpx import AsyncClient
import pytest
from polar.models.organization import Organization
from polar.models.user import User
from polar.postgres import AsyncSession
from polar.app import app
from polar.config import settings
from polar.models.user_organization import UserOrganization


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


@pytest.mark.asyncio
async def test_get_organization_no_member(
    organization: Organization,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/github/" + organization.name,
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_organization_member(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/github/" + organization.name,
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_get_organization_deleted(
    session: AsyncSession,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
) -> None:
    # soft-delete the organization
    organization.deleted_at = datetime.utcnow()
    await organization.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/github/" + organization.name,
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 404
