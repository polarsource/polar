import pytest
from httpx import AsyncClient

from polar.models import (
    ExternalOrganization,
    Organization,
    Product,
    Repository,
    UserOrganization,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_repository


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestListRepositories:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="anonymous"),
        AuthSubjectFixture(subject="user"),
    )
    async def test_anonymous_user(
        self,
        client: AsyncClient,
        repository: Repository,
        repository_linked: Repository,
        public_repository: Repository,
    ) -> None:
        response = await client.get("/v1/repositories/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2
        assert {item["id"] for item in json["items"]} == {
            str(repository_linked.id),
            str(public_repository.id),
        }

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization"),
    )
    async def test_organization(
        self,
        client: AsyncClient,
        repository: Repository,
        repository_linked: Repository,
        public_repository: Repository,
    ) -> None:
        response = await client.get("/v1/repositories/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(repository_linked.id)

    @pytest.mark.auth
    async def test_user_member(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        repository_linked: Repository,
        external_organization_linked: ExternalOrganization,
        user_organization: UserOrganization,
    ) -> None:
        repository_linked_private = await create_repository(
            save_fixture, external_organization_linked, is_private=True
        )
        response = await client.get("/v1/repositories/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2
        assert {item["id"] for item in json["items"]} == {
            str(repository_linked.id),
            str(repository_linked_private.id),
        }


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_repository_profile_settings_featured_organizations(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    repository_linked: Repository,
    session: AsyncSession,
) -> None:
    # then
    session.expunge_all()

    # set featured_projects
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "featured_organizations": [
                    str(organization.id),
                ],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
    assert response.json()["profile_settings"]["featured_organizations"] == [
        str(organization.id)
    ]

    # unset featured_projects
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "featured_organizations": [],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
    assert response.json()["profile_settings"]["featured_organizations"] == []


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_repository_profile_settings_highlighted_subscription_tiers(
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    product: Product,
    repository_linked: Repository,
    session: AsyncSession,
) -> None:
    # then
    session.expunge_all()

    # set highlighted_subscription_tiers
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "highlighted_subscription_tiers": [
                    str(product.id),
                ],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
    assert response.json()["profile_settings"]["highlighted_subscription_tiers"] == [
        str(product.id)
    ]

    # unset highlighted_subscription_tiers
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "highlighted_subscription_tiers": [],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
    assert response.json()["profile_settings"]["highlighted_subscription_tiers"] == []

    # more than 3 highlighted_subscription_tiers
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
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
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_repository_profile_settings_cover_image_url(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    repository_linked: Repository,
    session: AsyncSession,
) -> None:
    # then
    session.expunge_all()

    # set cover_image_url
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "cover_image_url": "https://example.com/image.jpg",
                "set_cover_image_url": True,
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
    assert (
        response.json()["profile_settings"]["cover_image_url"]
        == "https://example.com/image.jpg"
    )

    # setting cover_image_url without set_cover_image_url should not affect cover-image-url
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "cover_image_url": "https://example.com/another-image.jpg",
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
    assert (
        response.json()["profile_settings"]["cover_image_url"]
        == "https://example.com/image.jpg"
    )

    # setting featured_projects should not affect cover-image-url
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "featured_organizations": [str(organization.id)],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
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
    repository_linked: Repository,
    session: AsyncSession,
) -> None:
    # then
    session.expunge_all()

    # set description
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "description": "Hello world!",
                "set_description": True,
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
    assert response.json()["profile_settings"]["description"] == "Hello world!"

    # should trim description of leading/trailing whitespace
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "description": "     Hello whitespace!    ",
                "set_description": True,
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
    assert response.json()["profile_settings"]["description"] == "Hello whitespace!"

    # setting description without set_description should not affect description
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "description": "Hello moon!",
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(repository_linked.id)
    assert response.json()["profile_settings"]["description"] == "Hello whitespace!"

    # setting a description which exceeds the maximum length
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
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
    repository_linked: Repository,
    session: AsyncSession,
) -> None:
    # then
    session.expunge_all()

    # set links
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
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
    assert response.json()["id"] == str(repository_linked.id)
    assert response.json()["profile_settings"]["links"] == [
        "https://example.com/",
        "https://example.com/another-link",
    ]

    # must be a valid URL with tld & hostname
    # with pytest.raises(ValidationError):
    response = await client.patch(
        f"/v1/repositories/{repository_linked.id}",
        json={
            "profile_settings": {
                "links": [
                    "this is not a link",
                ],
            }
        },
    )

    assert response.status_code == 422  # expect unprocessable entity
