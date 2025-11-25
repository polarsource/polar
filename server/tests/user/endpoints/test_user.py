import pytest
from httpx import AsyncClient

from polar.kit.utils import utc_now
from polar.models import Organization, User, UserOrganization
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get_users_me_authed(user: User, client: AsyncClient) -> None:
    response = await client.get("/v1/users/me")

    assert response.status_code == 200
    json = response.json()

    assert json["email"] == user.email
    assert "oauth_accounts" in json


@pytest.mark.asyncio
async def test_get_users_me_no_auth(client: AsyncClient) -> None:
    response = await client.get(
        "/v1/users/me",
    )

    assert response.status_code == 401


@pytest.mark.asyncio
class TestDeleteUser:
    """
    Endpoint integration tests for user deletion.

    Note: Account deletion tests with Stripe mocks are in service tests
    (tests/user/service/test_user_delete.py) as they require more fine-grained
    control over mocks. These endpoint tests focus on the HTTP layer behavior.
    """

    async def test_anonymous(self, client: AsyncClient) -> None:
        """Anonymous users cannot delete accounts."""
        response = await client.delete("/v1/users/me")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_delete_user_no_organizations(
        self,
        client: AsyncClient,
        user: User,
    ) -> None:
        """User with no organizations can be deleted immediately."""
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
        """User with active organization cannot be deleted."""
        response = await client.delete("/v1/users/me")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is False
        assert "has_active_organizations" in json["blocked_reasons"]
        assert len(json["blocking_organizations"]) == 1
        assert json["blocking_organizations"][0]["id"] == str(organization.id)
        assert json["blocking_organizations"][0]["slug"] == organization.slug

    @pytest.mark.auth
    async def test_can_delete_with_deleted_organization(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """User can be deleted if all organizations are soft-deleted."""
        # Soft delete the organization
        organization.deleted_at = utc_now()
        await save_fixture(organization)

        response = await client.delete("/v1/users/me")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is True
        assert json["blocked_reasons"] == []

    @pytest.mark.auth
    async def test_pii_anonymization_response(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        """User deletion response indicates success."""
        user.avatar_url = "https://example.com/avatar.png"
        user.meta = {"signup": {"intent": "creator"}}
        await save_fixture(user)

        response = await client.delete("/v1/users/me")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is True
