import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import Organization, PayoutAccount, User, UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout_account


@pytest_asyncio.fixture
async def payout_account_organization_second(
    save_fixture: SaveFixture,
    organization_second: Organization,
    user_second: User,
) -> PayoutAccount:
    return await create_payout_account(save_fixture, organization_second, user_second)


@pytest.mark.asyncio
class TestListPayoutAccounts:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/payout-accounts/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_accounts(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_account_organization_second: PayoutAccount,
    ) -> None:
        response = await client.get("/v1/payout-accounts/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0


@pytest.mark.asyncio
class TestCreatePayoutAccount:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/payout-accounts/", json={})

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        client: AsyncClient,
        organization_second: Organization,
    ) -> None:
        response = await client.post(
            "/v1/payout-accounts/",
            json={
                "type": "stripe",
                "country": "US",
                "organization_id": str(organization_second.id),
            },
        )

        assert response.status_code == 422


@pytest.mark.asyncio
class TestGetPayoutAccount:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/payout-accounts/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_account(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_account_organization_second: PayoutAccount,
    ) -> None:
        response = await client.get(
            f"/v1/payout-accounts/{payout_account_organization_second.id}"
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestDeletePayoutAccount:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.delete(f"/v1/payout-accounts/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_delete_other_organization_account(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_account_organization_second: PayoutAccount,
    ) -> None:
        response = await client.delete(
            f"/v1/payout-accounts/{payout_account_organization_second.id}"
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestOnboardingLink:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/v1/payout-accounts/{uuid.uuid4()}/onboarding-link",
            params={"return_path": "/finance/account"},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_account(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_account_organization_second: PayoutAccount,
    ) -> None:
        response = await client.post(
            f"/v1/payout-accounts/{payout_account_organization_second.id}/onboarding-link",
            params={"return_path": "/finance/account"},
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestDashboardLink:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/v1/payout-accounts/{uuid.uuid4()}/dashboard-link"
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_account(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_account_organization_second: PayoutAccount,
    ) -> None:
        response = await client.post(
            f"/v1/payout-accounts/{payout_account_organization_second.id}/dashboard-link"
        )

        assert response.status_code == 404
