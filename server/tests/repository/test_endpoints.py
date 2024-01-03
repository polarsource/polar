import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_repository_private_not_member(
    organization: Organization,
    repository: Repository,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/repositories/{repository.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_repository_public(
    organization: Organization,
    public_repository: Repository,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/repositories/{public_repository.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(public_repository.id)
    assert response.json()["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_repository_private_member(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/repositories/{repository.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_list_repositories_no_member(
    organization: Organization,
    repository: Repository,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/repositories",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_list_repositories_member(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/repositories",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 0


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_list_repositories_admin(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    user_organization.is_admin = True
    await user_organization.save(session)

    response = await client.get(
        "/api/v1/repositories",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(repository.id)
    assert response.json()["items"][0]["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_repository_lookup_not_found(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        "/api/v1/repositories/lookup?platform=github&organization_name=foobar&repository_name=barbar",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_repository_lookup_public(
    organization: Organization,
    public_repository: Repository,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/repositories/lookup?platform=github&organization_name={organization.name}&repository_name={public_repository.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(public_repository.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_repository_lookup_private_member(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/repositories/lookup?platform=github&organization_name={organization.name}&repository_name={repository.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_repository_lookup_private_non_member(
    organization: Organization,
    repository: Repository,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/repositories/lookup?platform=github&organization_name={organization.name}&repository_name={repository.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_repository_search_no_matching_org(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/repositories/search?platform=github&organization_name=foobar",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_repository_search_org(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/repositories/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(repository.id)
