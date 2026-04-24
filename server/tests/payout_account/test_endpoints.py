import uuid
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.integrations.stripe.service import StripeService
from polar.models import Organization, PayoutAccount, User, UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_organization,
    create_payout_account,
    create_user,
)


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
    async def test_not_found(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/payout-accounts/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_admin_can_access(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user
        )

        response = await client.get(f"/v1/payout-accounts/{payout_account.id}")

        assert response.status_code == 200
        assert response.json()["id"] == str(payout_account.id)

    @pytest.mark.auth
    async def test_admin_can_access_with_multiple_orgs(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """A payout account linked to multiple organizations is accessible
        by its admin regardless of which org it's linked to."""
        payout_account = await create_payout_account(
            save_fixture, organization, user
        )

        # Create a second organization owned by the same user, sharing the
        # same payout account.
        second_account = await create_account(save_fixture, user)
        second_org = await create_organization(save_fixture, second_account)
        second_org.payout_account = payout_account
        await save_fixture(second_org)
        second_membership = UserOrganization(user=user, organization=second_org)
        await save_fixture(second_membership)

        response = await client.get(f"/v1/payout-accounts/{payout_account.id}")

        assert response.status_code == 200
        assert response.json()["id"] == str(payout_account.id)

    @pytest.mark.auth
    async def test_non_admin_member_cannot_access(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """A user who is a member of an org that uses a payout account
        but is NOT the payout account admin cannot access it."""
        other_user = await create_user(save_fixture)
        payout_account = await create_payout_account(
            save_fixture, organization, other_user
        )

        response = await client.get(f"/v1/payout-accounts/{payout_account.id}")

        assert response.status_code == 404

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
    async def test_admin_can_delete_unlinked_account(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MagicMock,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user
        )
        # Unlink from organization so delete is allowed
        organization.payout_account = None
        await save_fixture(organization)

        mock = mocker.MagicMock(spec=StripeService)
        mock.account_exists.return_value = True
        mock.retrieve_balance.return_value = ("usd", 0)
        mock.delete_account.return_value = None
        mocker.patch("polar.payout_account.service.stripe", new=mock)

        response = await client.delete(
            f"/v1/payout-accounts/{payout_account.id}"
        )

        assert response.status_code == 204

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
    async def test_admin_can_get_onboarding_link(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MagicMock,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user
        )

        mock = mocker.MagicMock(spec=StripeService)
        account_link = MagicMock()
        account_link.url = "https://connect.stripe.com/setup/test"
        mock.create_account_link.return_value = account_link
        mocker.patch("polar.payout_account.service.stripe", new=mock)

        response = await client.post(
            f"/v1/payout-accounts/{payout_account.id}/onboarding-link",
            params={"return_path": "/finance/account"},
        )

        assert response.status_code == 200
        assert response.json()["url"] == "https://connect.stripe.com/setup/test"

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
    async def test_admin_can_get_dashboard_link(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MagicMock,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user
        )

        mock = mocker.MagicMock(spec=StripeService)
        login_link = MagicMock()
        login_link.url = "https://connect.stripe.com/login/test"
        mock.create_login_link.return_value = login_link
        mocker.patch("polar.payout_account.service.stripe", new=mock)

        response = await client.post(
            f"/v1/payout-accounts/{payout_account.id}/dashboard-link"
        )

        assert response.status_code == 200
        assert response.json()["url"] == "https://connect.stripe.com/login/test"

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
