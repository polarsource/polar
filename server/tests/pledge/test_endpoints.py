import pytest
from httpx import AsyncClient

from polar.app import app
from polar.config import settings
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_get_pledge(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    issue: Issue,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/{pledge.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["id"] == str(pledge.id)
    assert response.json()["issue"]["id"] == str(issue.id)
    assert response.json()["issue"]["repository"]["id"] == str(repository.id)
    assert response.json()["issue"]["repository"]["organization"]["id"] == str(
        organization.id
    )


@pytest.mark.asyncio
async def test_get_pledge_not_admin(
    organization: Organization,
    pledging_organization: Organization,
    repository: Repository,
    pledge: Pledge,
    user: User,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = False
    await user_organization.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/{pledge.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_pledge_not_member(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/{pledge.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_search_pledge(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledge: Pledge,
    auth_jwt: str,
    session: AsyncSession,
    issue: Issue,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/search?platform=github&organization_name={organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(pledge.id)
    assert response.json()["items"][0]["issue"]["id"] == str(issue.id)
    assert response.json()["items"][0]["issue"]["repository"]["id"] == str(
        repository.id
    )
    assert response.json()["items"][0]["issue"]["repository"]["organization"][
        "id"
    ] == str(organization.id)


@pytest.mark.asyncio
async def test_search_pledge_no_admin(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    pledge: Pledge,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = False
    await user_organization.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/search?platform=github&organization_name={organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_search_pledge_no_member(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/pledges/search?platform=github&organization_name={organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_list_organization_pledges(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/github/{organization.name}/pledges",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()[0]["issue"]["id"] == str(pledge.issue_id)
    assert response.json()[0]["pledge"]["id"] == str(pledge.id)


@pytest.mark.asyncio
async def test_list_organization_pledges_no_member_404(
    organization: Organization,
    repository: Repository,
    pledge: Pledge,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/github/{organization.name}/pledges",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_personal_pledges(
    pledge: Pledge,
    user: User,
    auth_jwt: str,
    session: AsyncSession,
) -> None:
    pledge.by_organization_id = None
    pledge.by_user_id = user.id
    await pledge.save(session)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/me/pledges",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()[0]["id"] == str(pledge.id)


@pytest.mark.asyncio
async def test_list_personal_pledges_empty(
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/me/pledges",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json() == []
