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
        user_second: User,
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

        # donation from user
        await donation_sender.send_payment_intent_then_charge(
            payment_intent_id="pi_user",
            latest_charge="py_user",
            balance_transaction_id="bal_user",
            by_user_id=user.id,
        )

        # donation from user without avatar
        user_second.avatar_url = None
        await save_fixture(user_second)
        await donation_sender.send_payment_intent_then_charge(
            payment_intent_id="pi_user_second",
            latest_charge="py_user_second",
            balance_transaction_id="bal_user_second",
            by_user_id=user_second.id,
        )

        params = {"to_organization_id": str(organization.id)}
        response = await client.get("/api/v1/donations/search", params=params)

        assert response.status_code == 200
        json = response.json()

        # order by desc

        assert 5 == len(json["items"])

        # user without avatar
        assert json["items"][0]["donor"]
        assert json["items"][0]["donor"]["public_name"]
        assert json["items"][0]["donor"]["avatar_url"] is None

        # user with avatar
        assert json["items"][1]["donor"]
        assert json["items"][1]["donor"]["public_name"]
        assert json["items"][1]["donor"]["avatar_url"]

        # anonymous
        assert json["items"][2]["donor"] is None
