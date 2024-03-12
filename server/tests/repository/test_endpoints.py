import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


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
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

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


@pytest.mark.asyncio
@pytest.mark.authenticated
async def test_update_repository_profile_settings_featured_organizations(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    repository: Repository,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    # set featured_projects
    response = await client.patch(
        f"/api/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "featured_organizations": [
                    str(organization.id),
                ],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["profile_settings"]["featured_organizations"] == [
        str(organization.id)
    ]

    # unset featured_projects
    response = await client.patch(
        f"/api/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "featured_organizations": [],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["profile_settings"]["featured_organizations"] == []


@pytest.mark.asyncio
@pytest.mark.authenticated
async def test_update_repository_profile_settings_cover_image_url(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    repository: Repository,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    # set cover_image_url
    response = await client.patch(
        f"/api/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "cover_image_url": "https://example.com/image.jpg",
                "set_cover_image_url": True,
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert (
        response.json()["profile_settings"]["cover_image_url"]
        == "https://example.com/image.jpg"
    )

    # setting cover_image_url without set_cover_image_url should not affect cover-image-url
    response = await client.patch(
        f"/api/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "cover_image_url": "https://example.com/another-image.jpg",
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert (
        response.json()["profile_settings"]["cover_image_url"]
        == "https://example.com/image.jpg"
    )

    # setting featured_projects should not affect cover-image-url
    response = await client.patch(
        f"/api/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "featured_organizations": [str(organization.id)],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["profile_settings"]["featured_organizations"] == [
        str(organization.id)
    ]
    assert (
        response.json()["profile_settings"]["cover_image_url"]
        == "https://example.com/image.jpg"
    )
