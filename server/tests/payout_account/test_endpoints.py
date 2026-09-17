import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.scope import READ_ONLY_SCOPES
from polar.integrations.stripe.service import StripeService
from polar.models import Organization, PayoutAccount, User, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
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

    @pytest.mark.auth
    async def test_lists_the_organizations_using_each_account(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)
        free_account = await create_payout_account(save_fixture, organization, user)
        organization.payout_account = payout_account
        await save_fixture(organization)

        response = await client.get("/v1/payout-accounts/")

        assert response.status_code == 200
        accounts = {item["id"]: item for item in response.json()["items"]}
        assert accounts[str(payout_account.id)]["organizations"] == [
            {"id": str(organization.id), "slug": organization.slug}
        ]
        assert accounts[str(free_account.id)]["organizations"] == []


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

    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_impersonation_session_blocked(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Impersonation (READ_ONLY_SCOPES) cannot create a payout account."""
        response = await client.post(
            "/v1/payout-accounts/",
            json={
                "type": "stripe",
                "country": "US",
                "organization_id": str(organization.id),
            },
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestImpersonationCanList:
    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_impersonation_can_list(self, client: AsyncClient) -> None:
        """Impersonation (READ_ONLY_SCOPES) can list payout accounts."""
        response = await client.get("/v1/payout-accounts/")
        assert response.status_code == 200


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
        payout_account = await create_payout_account(save_fixture, organization, user)

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
        payout_account = await create_payout_account(save_fixture, organization, user)

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


@pytest.mark.asyncio
class TestSync:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(f"/v1/payout-accounts/{uuid.uuid4()}/sync")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_account(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payout_account_organization_second: PayoutAccount,
    ) -> None:
        response = await client.post(
            f"/v1/payout-accounts/{payout_account_organization_second.id}/sync"
        )

        assert response.status_code == 404


@pytest.fixture
def stripe_service_mock(mocker: MockerFixture) -> StripeService:
    mock = mocker.MagicMock(spec=StripeService)
    mocker.patch("polar.payout_account.service.stripe", new=mock)
    return mock


@pytest.mark.asyncio
class TestImpersonationCannotWrite:
    """A ``payouts:read``-only subject must not reach the four per-account
    write endpoints. Write endpoints require ``payouts:write``; a
    ``READ_ONLY_SCOPES`` subject is rejected with ``403`` and never reaches
    the Stripe side effects.
    """

    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_impersonation_cannot_delete(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)
        # Unlink so the service would proceed to stripe.delete_account if the
        # auth guard incorrectly admitted the read-only subject.
        organization.payout_account = None
        await save_fixture(organization)
        stripe_service_mock.account_exists.return_value = True  # type: ignore[attr-defined]
        stripe_service_mock.retrieve_balance.return_value = ("usd", 0)  # type: ignore[attr-defined]

        response = await client.delete(f"/v1/payout-accounts/{payout_account.id}")

        assert response.status_code == 403
        stripe_service_mock.delete_account.assert_not_called()  # type: ignore[attr-defined]

    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_impersonation_cannot_sync(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)

        response = await client.post(f"/v1/payout-accounts/{payout_account.id}/sync")

        assert response.status_code == 403
        stripe_service_mock.retrieve_account.assert_not_called()  # type: ignore[attr-defined]

    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_impersonation_cannot_onboarding_link(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)

        response = await client.post(
            f"/v1/payout-accounts/{payout_account.id}/onboarding-link",
            params={"return_path": "/finance/account"},
        )

        assert response.status_code == 403
        stripe_service_mock.create_account_link.assert_not_called()  # type: ignore[attr-defined]

    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_impersonation_cannot_dashboard_link(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)

        response = await client.post(
            f"/v1/payout-accounts/{payout_account.id}/dashboard-link"
        )

        assert response.status_code == 403
        stripe_service_mock.create_login_link.assert_not_called()  # type: ignore[attr-defined]


@pytest.mark.asyncio
class TestImpersonationCanRead:
    """A ``payouts:read``-only subject can still read individual payout
    accounts — the read guard accepts either ``payouts:read`` or
    ``payouts:write``.
    """

    @pytest.mark.auth(AuthSubjectFixture(scopes=READ_ONLY_SCOPES))
    async def test_impersonation_can_get(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)

        response = await client.get(f"/v1/payout-accounts/{payout_account.id}")

        assert response.status_code == 200
        assert response.json()["id"] == str(payout_account.id)
