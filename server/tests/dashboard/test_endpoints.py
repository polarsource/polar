from datetime import datetime
from httpx import AsyncClient
import pytest
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user import User
from polar.postgres import AsyncSession
from polar.app import app
from polar.config import settings
from polar.models.user_organization import UserOrganization


@pytest.mark.asyncio
async def test_get(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    issue: Issue,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/github/{organization.name}/dashboard",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    res = response.json()
    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)


@pytest.mark.asyncio
async def test_get_no_member(
    user: User,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/github/{organization.name}/dashboard",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 404
