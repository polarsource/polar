import pytest
from httpx import AsyncClient

from polar.app import app
from polar.config import settings
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization


@pytest.mark.asyncio
async def test_get_repository_private_not_member(
    organization: Organization,
    repository: Repository,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/repositories/{repository.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    print(response.text)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_repository_public(
    organization: Organization,
    public_repository: Repository,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/repositories/{public_repository.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    print(response.text)
    assert response.status_code == 200
    assert response.json()["id"] == str(public_repository.id)
    assert response.json()["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_get_repository_private_member(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/repositories/{repository.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    print(response.text)
    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_list_repositories_no_member(
    organization: Organization,
    repository: Repository,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/repositories",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_list_repositories_member(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/repositories",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(repository.id)
    assert response.json()["items"][0]["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
async def test_repository_lookup_not_found(
    organization: Organization,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/repositories/lookup?platform=github&organization_name=foobar&repository_name=barbar",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_repository_lookup_public(
    organization: Organization,
    public_repository: Repository,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/repositories/lookup?platform=github&organization_name={organization.name}&repository_name={public_repository.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["id"] == str(public_repository.id)


@pytest.mark.asyncio
async def test_repository_lookup_private_member(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/repositories/lookup?platform=github&organization_name={organization.name}&repository_name={repository.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)


@pytest.mark.asyncio
async def test_repository_lookup_private_non_member(
    organization: Organization,
    repository: Repository,
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/repositories/lookup?platform=github&organization_name={organization.name}&repository_name={repository.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_repository_search_no_matching_org(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/repositories/search?platform=github&organization_name=foobar",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_repository_search_org(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
) -> None:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            f"/api/v1/repositories/search?platform=github&organization_name={organization.name}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(repository.id)
