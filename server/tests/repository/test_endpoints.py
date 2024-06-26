import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from polar.models.organization import Organization
from polar.models.product import Product
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_repository_private_not_member(
    organization: Organization, repository: Repository, client: AsyncClient
) -> None:
    response = await client.get(f"/v1/repositories/{repository.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_repository_public(
    organization: Organization, public_repository: Repository, client: AsyncClient
) -> None:
    response = await client.get(f"/v1/repositories/{public_repository.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(public_repository.id)
    assert response.json()["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_repository_private_member(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get(f"/v1/repositories/{repository.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_repositories_no_member(
    organization: Organization, repository: Repository, client: AsyncClient
) -> None:
    response = await client.get("/v1/repositories")

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_repositories_member(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get("/v1/repositories")

    assert response.status_code == 200
    assert len(response.json()["items"]) == 0


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_repositories_admin(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.get("/v1/repositories")

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(repository.id)
    assert response.json()["items"][0]["organization"]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_repository_lookup_not_found(client: AsyncClient) -> None:
    response = await client.get(
        "/v1/repositories/lookup?platform=github&organization_name=foobar&repository_name=barbar"
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_repository_lookup_public(
    organization: Organization, public_repository: Repository, client: AsyncClient
) -> None:
    response = await client.get(
        f"/v1/repositories/lookup?platform=github&organization_name={organization.name}&repository_name={public_repository.name}"
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(public_repository.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_repository_lookup_private_member(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/v1/repositories/lookup?platform=github&organization_name={organization.name}&repository_name={repository.name}"
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_repository_lookup_private_non_member(
    organization: Organization,
    repository: Repository,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/v1/repositories/lookup?platform=github&organization_name={organization.name}&repository_name={repository.name}"
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_repository_search_no_matching_org(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/v1/repositories/search?platform=github&organization_name=foobar"
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_repository_search_org(
    organization: Organization,
    repository: Repository,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/v1/repositories/search?platform=github&organization_name={organization.name}"
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["id"] == str(repository.id)


@pytest.mark.asyncio
@pytest.mark.auth
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
        f"/v1/repositories/{repository.id}",
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
        f"/v1/repositories/{repository.id}",
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
@pytest.mark.auth
async def test_update_repository_profile_settings_highlighted_subscription_tiers(
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    product: Product,
    repository: Repository,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    # set highlighted_subscription_tiers
    response = await client.patch(
        f"/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "highlighted_subscription_tiers": [
                    str(product.id),
                ],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["profile_settings"]["highlighted_subscription_tiers"] == [
        str(product.id)
    ]

    # unset highlighted_subscription_tiers
    response = await client.patch(
        f"/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "highlighted_subscription_tiers": [],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["profile_settings"]["highlighted_subscription_tiers"] == []

    with pytest.raises(ValidationError):
        # more than 3 highlighted_subscription_tiers
        response = await client.patch(
            f"/v1/repositories/{repository.id}",
            json={
                "profile_settings": {
                    "highlighted_subscription_tiers": [
                        str(product.id),
                        str(product.id),
                        str(product.id),
                        str(product.id),
                    ],
                }
            },
        )


@pytest.mark.asyncio
@pytest.mark.auth
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
        f"/v1/repositories/{repository.id}",
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
        f"/v1/repositories/{repository.id}",
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
        f"/v1/repositories/{repository.id}",
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


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_repository_profile_settings_description(
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

    # set description
    response = await client.patch(
        f"/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "description": "Hello world!",
                "set_description": True,
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["profile_settings"]["description"] == "Hello world!"

    # should trim description of leading/trailing whitespace
    response = await client.patch(
        f"/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "description": "     Hello whitespace!    ",
                "set_description": True,
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["profile_settings"]["description"] == "Hello whitespace!"

    # setting description without set_description should not affect description
    response = await client.patch(
        f"/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "description": "Hello moon!",
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["profile_settings"]["description"] == "Hello whitespace!"

    # setting a description which exceeds the maximum length
    response = await client.patch(
        f"/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "description": "a" * 270,
                "set_description": True,
            }
        },
    )
    assert 422 == response.status_code
    assert response.json()["detail"][0]["type"] == "string_too_long"


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_repository_profile_settings_links(
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

    # set links
    response = await client.patch(
        f"/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "links": [
                    "https://example.com",
                    "https://example.com/another-link",
                ],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.id)
    assert response.json()["profile_settings"]["links"] == [
        "https://example.com/",
        "https://example.com/another-link",
    ]

    # must be a valid URL with tld & hostname
    # with pytest.raises(ValidationError):
    response = await client.patch(
        f"/v1/repositories/{repository.id}",
        json={
            "profile_settings": {
                "links": [
                    "this is not a link",
                ],
            }
        },
    )

    assert response.status_code == 422  # expect unprocessable entity
