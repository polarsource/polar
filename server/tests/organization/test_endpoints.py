from typing import Any

import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.kit.utils import utc_now
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization
from polar.organization.schemas import Organization as OrganizationSchema
from polar.postgres import AsyncSession
from polar.user_organization.schemas import OrganizationMember
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_organization(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    org = OrganizationSchema.model_validate(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_organization_member_only_fields_no_member(
    save_fixture: SaveFixture,
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    organization.billing_email = "billing@polar.sh"
    await save_fixture(organization)

    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    org = OrganizationSchema.model_validate(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id
    assert org.billing_email is None


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_organization_member_only_fields_is_member(
    save_fixture: SaveFixture,
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
) -> None:
    organization.billing_email = "billing@polar.sh"
    await save_fixture(organization)

    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    org = OrganizationSchema.model_validate(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id
    assert org.billing_email == "billing@polar.sh"


@pytest.mark.asyncio
async def test_update_organization_billing_email(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    org = OrganizationSchema.model_validate(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id
    assert org.billing_email is None

    # edit
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "billing_email": "billing_via_api@polar.sh",
        },
    )

    assert response.status_code == 200
    org = OrganizationSchema.model_validate(response.json())
    assert org.billing_email == "billing_via_api@polar.sh"

    # get again!
    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    org = OrganizationSchema.model_validate(response.json())
    assert org.billing_email == "billing_via_api@polar.sh"


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_list_organization_member(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/organizations",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 0


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_list_organization_member_allow_non_admin(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/organizations?is_admin_only=false",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_list_organization_member_admin(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.get(
        "/api/v1/organizations",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_organization_lookup_not_found(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        "/api/v1/organizations/lookup?platform=github&organization_name=foobar",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_organization_lookup(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        f"/api/v1/organizations/lookup?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_organization_search(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        f"/api/v1/organizations/search?platform=github&organization_name={organization.name}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_organization_search_no_matches(
    organization: Organization, auth_jwt: str, client: AsyncClient
) -> None:
    response = await client.get(
        "/api/v1/organizations/search?platform=github&organization_name=foobar",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_get_organization_deleted(
    save_fixture: SaveFixture,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    # soft-delete the organization
    organization.deleted_at = utc_now()
    await save_fixture(organization)

    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_update_organization_no_admin(
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "set_default_upfront_split_to_contributors": True,
            "default_upfront_split_to_contributors": 85,
        },
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_organization(
    organization: Organization,
    auth_jwt: str,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "set_default_upfront_split_to_contributors": True,
            "default_upfront_split_to_contributors": 85,
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["default_upfront_split_to_contributors"] == 85

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "default_upfront_split_to_contributors": 70,  # no change
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["default_upfront_split_to_contributors"] == 85

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        json={
            "set_default_upfront_split_to_contributors": True,  # unset!
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["default_upfront_split_to_contributors"] is None


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_list_members(
    session: AsyncSession,
    organization: Organization,
    user_organization_admin: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/organizations/{organization.id}/members",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 200

    items_r: list[dict[str, Any]] = response.json()["items"]
    items = [OrganizationMember.model_validate(r) for r in items_r]

    assert len(items) == 2

    admins = [i for i in items if i.is_admin]
    non_admins = [i for i in items if not i.is_admin]

    assert len(admins) == 1
    assert len(non_admins) == 1


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_list_members_not_member(
    session: AsyncSession,
    organization: Organization,
    # user_organization_admin: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    auth_jwt: str,
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/api/v1/organizations/{organization.id}/members",
        cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.authenticated
async def test_update_organization_profile_settings(
    organization: Organization,
    auth_jwt: str,
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

    # default
    response = await client.get(
        f"/api/v1/organizations/{organization.id}",
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"] == {
        "featured_projects": None,
        "featured_organizations": None,
        "description": None,
        "links": None,
    }

    # set featured_projects
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "featured_projects": [
                    str(repository.id),
                ],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["featured_projects"] == [
        str(repository.id)
    ]
    assert (
        response.json()["profile_settings"]["featured_organizations"] is None
    )  # untouched

    # set featured_organizations
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "featured_organizations": [
                    str(organization.id),
                ],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["featured_projects"] == [
        str(repository.id)
    ]  # untouched
    assert response.json()["profile_settings"]["featured_organizations"] == [
        str(organization.id)
    ]


@pytest.mark.asyncio
@pytest.mark.authenticated
async def test_update_organization_profile_settings_featured_projects(
    organization: Organization,
    auth_jwt: str,
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
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "featured_projects": [
                    str(repository.id),
                ],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["featured_projects"] == [
        str(repository.id)
    ]

    # unset featured_projects
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "featured_projects": [],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["featured_projects"] == []


@pytest.mark.asyncio
@pytest.mark.authenticated
async def test_update_organization_profile_settings_featured_organizations(
    organization: Organization,
    auth_jwt: str,
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
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "featured_organizations": [
                    str(organization.id),
                ],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["featured_organizations"] == [
        str(organization.id)
    ]

    # unset featured_projects
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "featured_organizations": [],
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["featured_organizations"] == []


@pytest.mark.asyncio
@pytest.mark.authenticated
async def test_update_organization_profile_settings_description(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    # set description
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "description": "Hello world!",
                "set_description": True,
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["description"] == "Hello world!"

    # should trim description of leading/trailing whitespace
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "description": "     Hello whitespace!    ",
                "set_description": True,
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["description"] == "Hello whitespace!"

    # setting description without set_description should not affect description
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "description": "Hello moon!",
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["description"] == "Hello whitespace!"

    # setting a description which exceeds the maximum length
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "description": "a" * 161,
                "set_description": True,
            }
        },
    )

    assert 422 == response.status_code
    assert response.json()["detail"][0]["type"] == "string_too_long"


@pytest.mark.asyncio
@pytest.mark.authenticated
async def test_update_organization_profile_settings_links(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    # set links
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
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
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["links"] == [
        "https://example.com/",
        "https://example.com/another-link",
    ]

    # must be a valid URL with tld & hostname
    # with pytest.raises(ValidationError):
    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={
            "profile_settings": {
                "links": [
                    "this is not a link",
                ],
            }
        },
    )

    assert response.status_code == 422  # expect unprocessable entity


@pytest.mark.asyncio
@pytest.mark.authenticated
async def test_donations_enabled(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={"donations_enabled": True},
    )
    assert response.status_code == 200
    assert response.json()["donations_enabled"] is True

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={"donations_enabled": None},
    )
    assert response.status_code == 200
    assert response.json()["donations_enabled"] is True  # no change

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={},
    )
    assert response.status_code == 200
    assert response.json()["donations_enabled"] is True  # no change

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={"donations_enabled": False},
    )
    assert response.status_code == 200
    assert response.json()["donations_enabled"] is False

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={"donations_enabled": None},
    )
    assert response.status_code == 200
    assert response.json()["donations_enabled"] is False  # no change

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={},
    )
    assert response.status_code == 200
    assert response.json()["donations_enabled"] is False  # no change


@pytest.mark.asyncio
@pytest.mark.authenticated
async def test_public_donation_timestamps(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.patch(
        f"/api/v1/organizations/{organization.id}",
        json={"public_donation_timestamps": True},
    )
    assert response.status_code == 200
    assert response.json()["public_donation_timestamps"] is True
