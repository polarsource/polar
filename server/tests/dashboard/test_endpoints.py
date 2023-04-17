from httpx import AsyncClient
import pytest
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
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
            f"/api/v1/dashboard/github/{organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    res = response.json()
    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)


@pytest.mark.asyncio
async def test_get_personal(
    user: User,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/dashboard/personal",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200


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
            f"/api/v1/dashboard/github/{organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_with_pledge(
    user: User,
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledging_organization: Organization,
    pledge: Pledge,
    issue: Issue,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/dashboard/github/{organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    res = response.json()

    assert len(res["data"]) == 1
    assert res["data"][0]["id"] == str(issue.id)
    assert len(res["data"][0]["relationships"]["pledges"]["data"]) == 1
    rel_pledged = res["data"][0]["relationships"]["pledges"]["data"][0]

    pledges = [x for x in res["included"] if x["type"] == "pledge"]
    assert len(pledges) == 1
    assert pledges[0]["id"] == rel_pledged["id"]
    assert pledges[0]["attributes"]["pledger_name"] == pledging_organization.name
