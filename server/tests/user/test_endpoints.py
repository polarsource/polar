import pytest
from httpx import AsyncClient

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
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
    # Admin embeds the finance scopes the dashboard gates on.
    permissions = organizations[0]["permissions"]
    assert OrganizationPermission.finance_read in permissions
    assert OrganizationPermission.organization_manage in permissions


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_users_me_embeds_member_permissions_without_admin_scopes(
    client: AsyncClient,
    save_fixture: SaveFixture,
    organization: Organization,
    user_organization: UserOrganization,
) -> None:
    user_organization.role = OrganizationRole.member
    await save_fixture(user_organization)

    response = await client.get("/v1/users/me")

    assert response.status_code == 200
    permissions = response.json()["organizations"][0]["permissions"]
    assert OrganizationPermission.finance_read not in permissions
    assert OrganizationPermission.organization_manage not in permissions


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
@pytest.mark.auth
async def test_get_users_me_excludes_sso_enforced_org_for_global_session(
    client: AsyncClient,
    save_fixture: SaveFixture,
    organization: Organization,
    user_organization: UserOrganization,
) -> None:
    # A non-SSO session cannot reach an org that enforces SSO, so it's excluded
    # from the accessible `organizations` list but still surfaced under
    # `member_organizations` (flagged `requires_sso`) so the dashboard can
    # redirect the member to SSO rather than 404.
    organization.sso_enforced = True
    await save_fixture(organization)

    response = await client.get("/v1/users/me")

    assert response.status_code == 200
    json = response.json()
    assert json["organizations"] == []
    assert json["member_organizations"] == [
        {
            "id": str(organization.id),
            "slug": organization.slug,
            "name": organization.name,
            "avatar_url": organization.avatar_url,
            "requires_sso": True,
        }
    ]


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_users_me_includes_sso_enforced_org_for_sso_session(
    client: AsyncClient,
    save_fixture: SaveFixture,
    auth_subject: AuthSubject[User],
    organization: Organization,
    user_organization: UserOrganization,
) -> None:
    organization.sso_enforced = True
    await save_fixture(organization)
    auth_subject.organization_ids = frozenset({organization.id})

    response = await client.get("/v1/users/me")

    assert response.status_code == 200
    json = response.json()
    organizations = json["organizations"]
    assert len(organizations) == 1
    assert organizations[0]["id"] == str(organization.id)
    # It's accessible in an SSO-scoped session and still listed as a membership.
    assert json["member_organizations"] == [
        {
            "id": str(organization.id),
            "slug": organization.slug,
            "name": organization.name,
            "avatar_url": organization.avatar_url,
            "requires_sso": True,
        }
    ]


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
                    "chargeback_prevention": True,
                }
            },
        )

        assert response.status_code == 200
        assert response.json()["notification_settings"] == {
            "new_order": False,
            "new_subscription": True,
            "chargeback_prevention": True,
        }

        # Persisted: a subsequent read returns the new value.
        get_response = await client.get(url)
        assert get_response.json()["notification_settings"] == {
            "new_order": False,
            "new_subscription": True,
            "chargeback_prevention": True,
        }

    @pytest.mark.auth
    async def test_chargeback_prevention_round_trips(
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
                    "new_order": True,
                    "new_subscription": True,
                    "chargeback_prevention": False,
                }
            },
        )

        assert response.status_code == 200
        assert response.json()["notification_settings"] == {
            "new_order": True,
            "new_subscription": True,
            "chargeback_prevention": False,
        }

        get_response = await client.get(url)
        assert get_response.json()["notification_settings"] == {
            "new_order": True,
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
