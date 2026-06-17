import pytest
from httpx import AsyncClient

from polar.auth.scope import READ_ONLY_SCOPES
from polar.kit.utils import utc_now
from polar.models import Organization, User, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.models.user_organization import OrganizationRole
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_users_me_authed(user: User, client: AsyncClient) -> None:
    response = await client.get("/v1/users/me")

    assert response.status_code == 200
    json = response.json()

    assert json["email"] == user.email
    assert "oauth_accounts" in json
    assert json["organizations"] == []


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_users_me_embeds_organizations_with_role(
    client: AsyncClient,
    save_fixture: SaveFixture,
    organization: Organization,
    user_organization: UserOrganization,
) -> None:
    user_organization.role = OrganizationRole.admin
    await save_fixture(user_organization)

    response = await client.get("/v1/users/me")

    assert response.status_code == 200
    organizations = response.json()["organizations"]
    assert len(organizations) == 1
    assert organizations[0]["id"] == str(organization.id)
    assert organizations[0]["role"] == OrganizationRole.admin.value


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_users_me_excludes_blocked_organizations(
    client: AsyncClient,
    save_fixture: SaveFixture,
    organization: Organization,
    user_organization: UserOrganization,
) -> None:
    # Blocked orgs are filtered out by `GET /v1/organizations/`; mirror
    # that here so frontend redirect targets stay consistent and users
    # don't land on a dashboard that 404s on the org slug lookup.
    organization.set_status(OrganizationStatus.BLOCKED)
    await save_fixture(organization)

    response = await client.get("/v1/users/me")

    assert response.status_code == 200
    assert response.json()["organizations"] == []


@pytest.mark.asyncio
async def test_get_users_me_no_auth(client: AsyncClient) -> None:
    response = await client.get("/v1/users/me")

    assert response.status_code == 401


@pytest.mark.asyncio
class TestDeleteUser:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.delete("/v1/users/me")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_no_organizations(
        self,
        client: AsyncClient,
        user: User,
    ) -> None:
        response = await client.delete("/v1/users/me")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is True
        assert json["blocked_reasons"] == []
        assert json["blocking_organizations"] == []

    @pytest.mark.auth
    async def test_blocked_with_active_organization(
        self,
        client: AsyncClient,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.delete("/v1/users/me")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is False
        assert "has_active_organizations" in json["blocked_reasons"]
        assert len(json["blocking_organizations"]) == 1
        assert json["blocking_organizations"][0]["id"] == str(organization.id)
        assert json["blocking_organizations"][0]["slug"] == organization.slug

    @pytest.mark.auth
    async def test_with_deleted_organization(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.deleted_at = utc_now()
        await save_fixture(organization)

        response = await client.delete("/v1/users/me")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is True
        assert json["blocked_reasons"] == []

    @pytest.mark.auth
    async def test_pii_anonymization(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        user.avatar_url = "https://example.com/avatar.png"
        user.meta = {"signup": {"intent": "creator"}}
        await save_fixture(user)

        response = await client.delete("/v1/users/me")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is True


@pytest.mark.asyncio
class TestImpersonationGate:
    """Sessions with ``READ_ONLY_SCOPES`` (i.e. backoffice impersonation)
    can read user-personal endpoints but cannot mutate them."""

    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_can_get_me(self, user: User, client: AsyncClient) -> None:
        response = await client.get("/v1/users/me")
        assert response.status_code == 200

    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_cannot_patch_me(self, user: User, client: AsyncClient) -> None:
        response = await client.patch(
            "/v1/users/me", json={"avatar_url": "https://example.com/x.png"}
        )
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_cannot_delete_me(self, user: User, client: AsyncClient) -> None:
        response = await client.delete("/v1/users/me")
        assert response.status_code == 403


@pytest.mark.asyncio
class TestGetMyNotificationSettings:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            f"/v1/users/me/organizations/{organization.id}/notification-settings"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_member(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        user_organization.notification_settings = {
            "new_order": True,
            "new_subscription": False,
            "chargeback_prevention": True,
        }
        await save_fixture(user_organization)

        response = await client.get(
            f"/v1/users/me/organizations/{organization.id}/notification-settings"
        )

        assert response.status_code == 200
        assert response.json()["notification_settings"] == {
            "new_order": True,
            "new_subscription": False,
            "chargeback_prevention": True,
        }

    @pytest.mark.auth
    async def test_non_member_returns_404(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        # Authed user is not a member of `organization` (no user_organization
        # fixture requested). The frontend treats this 404 as "no settings".
        response = await client.get(
            f"/v1/users/me/organizations/{organization.id}/notification-settings"
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestUpdateMyNotificationSettings:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.patch(
            f"/v1/users/me/organizations/{organization.id}/notification-settings",
            json={
                "notification_settings": {
                    "new_order": True,
                    "new_subscription": True,
                    "chargeback_prevention": True,
                }
            },
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_member_updates_and_persists(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        url = f"/v1/users/me/organizations/{organization.id}/notification-settings"
        response = await client.patch(
            url,
            json={
                "notification_settings": {
                    "new_order": False,
                    "new_subscription": True,
                    "chargeback_prevention": False,
                }
            },
        )

        assert response.status_code == 200
        assert response.json()["notification_settings"] == {
            "new_order": False,
            "new_subscription": True,
            "chargeback_prevention": False,
        }

        # Persisted: a subsequent read returns the new value.
        get_response = await client.get(url)
        assert get_response.json()["notification_settings"] == {
            "new_order": False,
            "new_subscription": True,
            "chargeback_prevention": False,
        }

    @pytest.mark.auth
    async def test_non_member_returns_404(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.patch(
            f"/v1/users/me/organizations/{organization.id}/notification-settings",
            json={
                "notification_settings": {
                    "new_order": True,
                    "new_subscription": True,
                    "chargeback_prevention": True,
                }
            },
        )
        assert response.status_code == 404
