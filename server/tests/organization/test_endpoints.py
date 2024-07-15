from typing import Any

import pytest
from httpx import AsyncClient

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
@pytest.mark.auth
async def test_get_organization(
    organization: Organization, client: AsyncClient
) -> None:
    response = await client.get(f"/v1/organizations/{organization.id}")

    assert response.status_code == 200

    org = OrganizationSchema.model_validate(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_blocked_organization_404(
    organization_blocked: Organization, client: AsyncClient
) -> None:
    response = await client.get(f"/v1/organizations/{organization_blocked.id}")

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_organization_member_only_fields_no_member(
    save_fixture: SaveFixture,
    organization: Organization,
    client: AsyncClient,
) -> None:
    organization.billing_email = "billing@polar.sh"
    await save_fixture(organization)

    response = await client.get(f"/v1/organizations/{organization.id}")

    assert response.status_code == 200

    org = OrganizationSchema.model_validate(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id
    assert org.billing_email is None


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_organization_member_only_fields_is_member(
    save_fixture: SaveFixture,
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
) -> None:
    organization.billing_email = "billing@polar.sh"
    await save_fixture(organization)

    response = await client.get(f"/v1/organizations/{organization.id}")

    assert response.status_code == 200

    org = OrganizationSchema.model_validate(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id
    assert org.billing_email == "billing@polar.sh"


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_organization_billing_email(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    # then
    session.expunge_all()

    response = await client.get(f"/v1/organizations/{organization.id}")

    assert response.status_code == 200

    org = OrganizationSchema.model_validate(response.json())
    assert response.json()["id"] == str(organization.id)
    assert org.id == organization.id
    assert org.billing_email is None

    # edit
    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={
            "billing_email": "billing_via_api@polar.sh",
        },
    )

    assert response.status_code == 200
    org = OrganizationSchema.model_validate(response.json())
    assert org.billing_email == "billing_via_api@polar.sh"

    # get again!
    response = await client.get(f"/v1/organizations/{organization.id}")

    assert response.status_code == 200
    org = OrganizationSchema.model_validate(response.json())
    assert org.billing_email == "billing_via_api@polar.sh"


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_organization_member(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get("/v1/organizations/")

    assert response.status_code == 200
    assert len(response.json()["items"]) == 0


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_blocked_organization_member(
    organization_blocked: Organization,
    user_organization_blocked: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get("/v1/organizations/")

    assert response.status_code == 200

    orgs = response.json()["items"]
    for org in orgs:
        assert org.id != str(organization_blocked.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_organization_member_allow_non_admin(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get("/v1/organizations/?is_admin_only=false")

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_organization_member_admin(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
    session: AsyncSession,
    save_fixture: SaveFixture,
) -> None:
    user_organization.is_admin = True
    await save_fixture(user_organization)

    response = await client.get("/v1/organizations/")

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_organization_lookup_not_found_v2(
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get("/v1/organizations/?name=foobar")

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 0


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_organization_lookup_v2(
    organization: Organization,
    organization_second: Organization,
    user_organization_admin: UserOrganization,  # makes User an admin of Organization
    client: AsyncClient,
    save_fixture: SaveFixture,
) -> None:
    user_organization_second_admin = UserOrganization(
        user_id=user_organization_admin.user_id,
        organization_id=organization_second.id,
        is_admin=True,
    )
    await save_fixture(user_organization_second_admin)
    unfiltered = await client.get("/v1/organizations/")
    assert unfiltered.status_code == 200
    items = unfiltered.json()["items"]
    assert len(items) == 2

    filtered = await client.get(f"/v1/organizations/?name={organization.name}")
    assert filtered.status_code == 200
    items = filtered.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_organization_lookup_not_found(
    organization: Organization, client: AsyncClient
) -> None:
    response = await client.get(
        "/v1/organizations/lookup?platform=github&organization_name=foobar"
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_organization_lookup(
    organization: Organization, client: AsyncClient
) -> None:
    response = await client.get(
        f"/v1/organizations/lookup?platform=github&organization_name={organization.name}"
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_organization_blocked_lookup_404(
    organization_blocked: Organization, client: AsyncClient
) -> None:
    response = await client.get(
        f"/v1/organizations/lookup?platform=github&organization_name={organization_blocked.name}"
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_organization_search(
    organization: Organization, client: AsyncClient
) -> None:
    response = await client.get(
        f"/v1/organizations/search?platform=github&organization_name={organization.name}"
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_organization_search_no_matches(
    organization: Organization, client: AsyncClient
) -> None:
    response = await client.get(
        "/v1/organizations/search?platform=github&organization_name=foobar"
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_organization_blocked_search(
    organization_blocked: Organization, client: AsyncClient
) -> None:
    response = await client.get(
        f"/v1/organizations/search?platform=github&organization_name={organization_blocked.name}"
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_organization_deleted(
    save_fixture: SaveFixture,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    # soft-delete the organization
    organization.deleted_at = utc_now()
    await save_fixture(organization)

    response = await client.get(f"/v1/organizations/{organization.id}")

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get_organization_blocked_404(
    save_fixture: SaveFixture,
    organization_blocked: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.get(f"/v1/organizations/{organization_blocked.id}")

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_update_organization_no_admin(
    organization: Organization, client: AsyncClient
) -> None:
    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"default_upfront_split_to_contributors": 85},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_update_blocked_organization_no_admin_404(
    organization_blocked: Organization, client: AsyncClient
) -> None:
    response = await client.patch(
        f"/v1/organizations/{organization_blocked.id}",
        json={"default_upfront_split_to_contributors": 85},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_organization(
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
        f"/v1/organizations/{organization.id}",
        json={
            "default_upfront_split_to_contributors": 85,
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["default_upfront_split_to_contributors"] == 85

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={},  # no change
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["default_upfront_split_to_contributors"] == 85

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"default_upfront_split_to_contributors": None},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["default_upfront_split_to_contributors"] is None


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_members(
    session: AsyncSession,
    organization: Organization,
    user_organization_admin: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    client: AsyncClient,
) -> None:
    response = await client.get(f"/v1/organizations/{organization.id}/members")

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
@pytest.mark.auth
async def test_list_members_not_member(
    session: AsyncSession,
    organization: Organization,
    # user_organization_admin: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    client: AsyncClient,
) -> None:
    response = await client.get(f"/v1/organizations/{organization.id}/members")

    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_organization_profile_settings(
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

    # default
    response = await client.get(
        f"/v1/organizations/{organization.id}",
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"] == {
        "featured_projects": None,
        "featured_organizations": None,
        "description": None,
        "links": None,
        "subscribe": {
            "promote": True,
            "show_count": True,
            "count_free": True,
        },
    }

    # set featured_projects
    response = await client.patch(
        f"/v1/organizations/{organization.id}",
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
        f"/v1/organizations/{organization.id}",
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
@pytest.mark.auth
async def test_update_organization_profile_settings_featured_projects(
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
        f"/v1/organizations/{organization.id}",
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
        f"/v1/organizations/{organization.id}",
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
@pytest.mark.auth
async def test_update_organization_profile_settings_featured_organizations(
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
        f"/v1/organizations/{organization.id}",
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
        f"/v1/organizations/{organization.id}",
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
@pytest.mark.auth
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
        f"/v1/organizations/{organization.id}",
        json={"profile_settings": {"description": "Hello world!"}},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["description"] == "Hello world!"

    # should trim description of leading/trailing whitespace
    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"profile_settings": {"description": "     Hello whitespace!    "}},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["description"] == "Hello whitespace!"

    # omit description should not affect it
    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"profile_settings": {}},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["description"] == "Hello whitespace!"

    # setting a description which exceeds the maximum length
    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"profile_settings": {"description": "a" * 161}},
    )

    assert 422 == response.status_code
    assert response.json()["detail"][0]["type"] == "string_too_long"


@pytest.mark.asyncio
@pytest.mark.auth
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
        f"/v1/organizations/{organization.id}",
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
        f"/v1/organizations/{organization.id}",
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
@pytest.mark.auth
async def test_issue_funding_enabled(
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
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {"issue_funding_enabled": True}},
    )
    assert response.status_code == 200
    assert response.json()["feature_settings"]["issue_funding_enabled"] is True

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {}},
    )
    assert response.status_code == 200
    assert (
        response.json()["feature_settings"]["issue_funding_enabled"] is True
    )  # no change

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {"issue_funding_enabled": False}},
    )
    assert response.status_code == 200
    assert response.json()["feature_settings"]["issue_funding_enabled"] is False

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {}},
    )
    assert response.status_code == 200
    assert (
        response.json()["feature_settings"]["issue_funding_enabled"] is False
    )  # no change


@pytest.mark.asyncio
@pytest.mark.auth
async def test_articles_enabled(
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
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {"articles_enabled": True}},
    )
    assert response.status_code == 200
    assert response.json()["feature_settings"]["articles_enabled"] is True

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {}},
    )
    assert response.status_code == 200
    assert response.json()["feature_settings"]["articles_enabled"] is True  # no change

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {"articles_enabled": False}},
    )
    assert response.status_code == 200
    assert response.json()["feature_settings"]["articles_enabled"] is False

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {}},
    )
    assert response.status_code == 200
    assert response.json()["feature_settings"]["articles_enabled"] is False  # no change


@pytest.mark.asyncio
@pytest.mark.auth
async def test_subscriptions_enabled(
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
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {"subscriptions_enabled": True}},
    )
    assert response.status_code == 200
    assert response.json()["feature_settings"]["subscriptions_enabled"] is True

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {}},
    )
    assert response.status_code == 200
    assert (
        response.json()["feature_settings"]["subscriptions_enabled"] is True
    )  # no change

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {"subscriptions_enabled": False}},
    )
    assert response.status_code == 200
    assert response.json()["feature_settings"]["subscriptions_enabled"] is False

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"feature_settings": {}},
    )
    assert response.status_code == 200
    assert (
        response.json()["feature_settings"]["subscriptions_enabled"] is False
    )  # no change


@pytest.mark.asyncio
@pytest.mark.auth
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
        f"/v1/organizations/{organization.id}",
        json={"donations_enabled": True},
    )
    assert response.status_code == 200
    assert response.json()["donations_enabled"] is True

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={},
    )
    assert response.status_code == 200
    assert response.json()["donations_enabled"] is True  # no change

    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"donations_enabled": False},
    )
    assert response.status_code == 200
    assert response.json()["donations_enabled"] is False


@pytest.mark.asyncio
@pytest.mark.auth
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
        f"/v1/organizations/{organization.id}",
        json={"public_donation_timestamps": True},
    )
    assert response.status_code == 200
    assert response.json()["public_donation_timestamps"] is True
