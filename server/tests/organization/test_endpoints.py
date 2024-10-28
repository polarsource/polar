import uuid

import pytest
from httpx import AsyncClient

from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestListOrganizations:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="anonymous"),
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_no_filter(
        self,
        client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        organization_blocked: Organization,
    ) -> None:
        response = await client.get("/v1/organizations/")

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_filter_slug(
        self,
        client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        organization_blocked: Organization,
    ) -> None:
        response = await client.get(
            "/v1/organizations/", params={"slug": organization.slug}
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(organization.id)

    @pytest.mark.auth(AuthSubjectFixture(subject="anonymous"))
    async def test_filter_anonymous_is_member_true(
        self,
        client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        organization_blocked: Organization,
    ) -> None:
        response = await client.get("/v1/organizations/", params={"is_member": True})

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_filter_user_is_member_true(
        self,
        client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        organization_blocked: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/organizations/", params={"is_member": True})

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(organization.id)

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_filter_user_is_member_false(
        self,
        client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        organization_blocked: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/organizations/", params={"is_member": False})

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(organization_second.id)


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestGetOrganization:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="anonymous"),
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/organizations/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="anonymous"), AuthSubjectFixture(subject="user")
    )
    async def test_blocked(
        self, client: AsyncClient, organization_blocked: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization_blocked.id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="anonymous"),
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(self, client: AsyncClient, organization: Organization) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(organization.id)


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestUpdateOrganization:
    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/organizations/{uuid.uuid4()}", json={})

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_admin(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.patch(f"/v1/organizations/{organization.id}", json={})

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_valid_user(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={"default_upfront_split_to_contributors": 50.0},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["default_upfront_split_to_contributors"] == 50.0


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_members(
    session: AsyncSession,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    client: AsyncClient,
) -> None:
    response = await client.get(f"/v1/organizations/{organization.id}/members")

    assert response.status_code == 200

    json = response.json()
    assert len(json["items"]) == 2


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_list_members_not_member(
    session: AsyncSession,
    organization: Organization,
    # user_organization: UserOrganization,  # makes User a member of Organization
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
) -> None:
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
        "enabled": None,
        "accent_color": None,
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
) -> None:
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
) -> None:
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
async def test_update_organization_profile_settings_enabled(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    session: AsyncSession,
) -> None:
    # then
    session.expunge_all()

    # set enabled
    response = await client.patch(
        f"/v1/organizations/{organization.id}",
        json={"profile_settings": {"enabled": True}},
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(organization.id)
    assert response.json()["profile_settings"]["enabled"] is True


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update_organization_profile_settings_links(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    session: AsyncSession,
) -> None:
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
) -> None:
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
) -> None:
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
async def test_donations_enabled(
    organization: Organization,
    client: AsyncClient,
    user_organization: UserOrganization,  # makes User a member of Organization
    session: AsyncSession,
) -> None:
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
