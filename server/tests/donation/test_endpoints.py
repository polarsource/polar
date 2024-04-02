import pytest
from httpx import AsyncClient

from polar.models import User
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from tests.donation.conftest import DonationSender
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearch:
    async def test_unauthenticated(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        params = {"to_organization_id": str(organization.id)}
        response = await client.get("/api/v1/donations/search", params=params)
        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_authenticated_not_member(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        params = {"to_organization_id": str(organization.id)}
        response = await client.get("/api/v1/donations/search", params=params)
        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_authenticated_not_admin(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        user_organization.is_admin = False
        await save_fixture(user_organization)

        params = {"to_organization_id": str(organization.id)}
        response = await client.get("/api/v1/donations/search", params=params)

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_authenticated(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        params = {"to_organization_id": str(organization.id)}
        response = await client.get("/api/v1/donations/search", params=params)

        assert response.status_code == 200
        json = response.json()

        assert {"items": [], "pagination": {"total_count": 0, "max_page": 0}} == json

    @pytest.mark.authenticated
    async def test_with_data(
        self,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
        donation_sender: DonationSender,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        # 3 donations
        for x in range(3):
            await donation_sender.send_payment_intent_then_charge(
                payment_intent_id=f"pi_{x}",
                latest_charge=f"py_{x}",
                balance_transaction_id=f"bal_{x}",
            )

        params = {"to_organization_id": str(organization.id)}
        response = await client.get("/api/v1/donations/search", params=params)

        assert response.status_code == 200
        json = response.json()

        assert 3 == len(json["items"])
