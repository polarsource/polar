import uuid

import pytest
from httpx import AsyncClient

from polar.models import Organization, User
from polar.models.organization import OrganizationStatus
from polar.models.user_organization import OrganizationRole, UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account


@pytest.mark.asyncio
class TestPolicyGuardGetAccount:
    """Test PolicyGuard behavior on GET /organizations/{id}/account."""

    async def test_anonymous_returns_401(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/organizations/{uuid.uuid4()}/account")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_non_member_returns_404(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/account")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_nonexistent_org_returns_404(
        self,
        client: AsyncClient,
    ) -> None:
        response = await client.get(f"/v1/organizations/{uuid.uuid4()}/account")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_member_non_admin_returns_403(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        user_organization.role = OrganizationRole.member
        await save_fixture(user_organization)

        response = await client.get(f"/v1/organizations/{organization.id}/account")
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()

    @pytest.mark.auth
    async def test_admin_returns_200(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.account = await create_account(save_fixture, user=user)
        await save_fixture(organization)

        response = await client.get(f"/v1/organizations/{organization.id}/account")
        assert response.status_code == 200

    @pytest.mark.auth
    async def test_blocked_org_returns_404(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.account = await create_account(save_fixture, user=user)
        organization.set_status(OrganizationStatus.BLOCKED)
        await save_fixture(organization)

        response = await client.get(f"/v1/organizations/{organization.id}/account")
        assert response.status_code == 404


@pytest.mark.asyncio
class TestPolicyGuardUpdateOrganization:
    """Test PolicyGuard behavior on PATCH /organizations/{id}."""

    async def test_anonymous_returns_401(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/organizations/{uuid.uuid4()}", json={})
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_non_admin_returns_403_with_message(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        user_organization.role = OrganizationRole.member
        await save_fixture(user_organization)

        response = await client.patch(
            f"/v1/organizations/{organization.id}", json={"name": "Updated"}
        )
        assert response.status_code == 403
        assert (
            response.json()["detail"]
            == "You don't have permission to manage the organization"
        )


@pytest.mark.asyncio
class TestPolicyGuardDeleteOrganization:
    """Test PolicyGuard behavior on DELETE /organizations/{id}."""

    async def test_anonymous_returns_401(self, client: AsyncClient) -> None:
        response = await client.delete(f"/v1/organizations/{uuid.uuid4()}")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_non_member_returns_404(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.delete(f"/v1/organizations/{organization.id}")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_non_admin_returns_403_with_message(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        user_organization.role = OrganizationRole.member
        await save_fixture(user_organization)

        response = await client.delete(f"/v1/organizations/{organization.id}")
        assert response.status_code == 403
        assert (
            response.json()["detail"]
            == "You don't have permission to manage the organization"
        )


@pytest.mark.asyncio
class TestPolicyGuardInviteMember:
    """Test PolicyGuard behavior on POST /organizations/{id}/members/invite."""

    async def test_anonymous_returns_401(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/v1/organizations/{uuid.uuid4()}/members/invite",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_non_member_returns_404(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/members/invite",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_non_admin_returns_403(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        user_organization.role = OrganizationRole.member
        await save_fixture(user_organization)

        response = await client.post(
            f"/v1/organizations/{organization.id}/members/invite",
            json={"email": "newmember@example.com"},
        )
        assert response.status_code == 403
        assert (
            response.json()["detail"] == "You don't have permission to manage members"
        )


@pytest.mark.asyncio
class TestPolicyGuardRemoveMember:
    """Test PolicyGuard behavior on DELETE /organizations/{id}/members/{user_id}."""

    async def test_anonymous_returns_401(self, client: AsyncClient) -> None:
        response = await client.delete(
            f"/v1/organizations/{uuid.uuid4()}/members/{uuid.uuid4()}"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_non_admin_returns_404(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.delete(
            f"/v1/organizations/{organization.id}/members/{uuid.uuid4()}"
        )
        assert response.status_code == 404
