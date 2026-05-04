import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import Product, User
from polar.models.account import Account
from polar.models.organization import Organization, OrganizationStatus
from polar.models.subscription import SubscriptionStatus
from polar.models.user_organization import UserOrganization
from polar.payout_account.service import PayoutAccountServiceError
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_customer,
    create_order,
    create_payout_account,
    create_subscription,
    create_user,
)


@pytest.mark.asyncio
class TestListOrganizations:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/organizations/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(self, client: AsyncClient) -> None:
        response = await client.get("/v1/organizations/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/organizations/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
class TestGetOrganization:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/organizations/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(organization.id)


@pytest.mark.asyncio
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

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid_user(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}", json={"name": "Updated"}
        )

        assert response.status_code == 200

        json = response.json()
        assert json["name"] == "Updated"

    @pytest.mark.auth
    async def test_negative_revenue_validation(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Test negative future_annual_revenue
        response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "details": {
                    "about": "Test company",
                    "product_description": "SaaS product",
                    "future_annual_revenue": -1000,
                    "switching": False,
                    "previous_annual_revenue": 25000,
                }
            },
        )

        assert response.status_code == 422
        error_detail = response.json()["detail"]
        assert any("future_annual_revenue" in str(error) for error in error_detail)

    @pytest.mark.auth
    async def test_negative_previous_revenue_validation(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Test negative previous_annual_revenue
        response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "details": {
                    "about": "Test company",
                    "product_description": "SaaS product",
                    "future_annual_revenue": 50000,
                    "switching": False,
                    "previous_annual_revenue": -5000,
                }
            },
        )

        assert response.status_code == 422
        error_detail = response.json()["detail"]
        assert any("previous_annual_revenue" in str(error) for error in error_detail)

    @pytest.mark.auth
    async def test_enable_seat_based_pricing_with_member_model(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": False,
        }
        await save_fixture(organization)

        response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "feature_settings": {
                    "seat_based_pricing_enabled": True,
                },
            },
        )

        assert response.status_code == 200
        assert response.json()["feature_settings"]["seat_based_pricing_enabled"] is True

    @pytest.mark.auth
    async def test_enable_seat_based_pricing_without_member_model(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {
            "member_model_enabled": False,
            "seat_based_pricing_enabled": False,
        }
        await save_fixture(organization)

        response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "feature_settings": {
                    "seat_based_pricing_enabled": True,
                },
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_disable_seat_based_pricing_when_enabled(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "feature_settings": {
                    "seat_based_pricing_enabled": False,
                },
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_update_customer_portal_settings_without_customer_key(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Regression test: orgs created before `customer.allow_email_change`
        # was added have no "customer" key in customer_portal_settings.
        # The frontend form sends the full settings on any toggle without
        # necessarily providing a "customer" value, which previously failed
        # validation with a 422.
        response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "customer_portal_settings": {
                    "usage": {"show": True},
                    "subscription": {
                        "update_seats": False,
                        "update_plan": True,
                    },
                },
            },
        )

        assert response.status_code == 200
        settings = response.json()["customer_portal_settings"]
        assert settings["subscription"]["update_seats"] is False
        assert settings["subscription"]["update_plan"] is True

    @pytest.mark.auth
    async def test_update_customer_portal_settings_with_empty_customer(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Regression test: react-hook-form registers the
        # `customer.allow_email_change` field but existing orgs have no
        # value, so the form serializes `customer: {}` (undefined stripped
        # by JSON). allow_email_change must be NotRequired so this validates.
        response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "customer_portal_settings": {
                    "usage": {"show": True},
                    "subscription": {
                        "update_seats": False,
                        "update_plan": True,
                    },
                    "customer": {},
                },
            },
        )

        assert response.status_code == 200
        assert (
            response.json()["customer_portal_settings"]["subscription"]["update_seats"]
            is False
        )

    @pytest.mark.auth
    async def test_update_customer_portal_settings_with_full_customer(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "customer_portal_settings": {
                    "usage": {"show": True},
                    "subscription": {
                        "update_seats": True,
                        "update_plan": True,
                    },
                    "customer": {"allow_email_change": True},
                },
            },
        )

        assert response.status_code == 200
        settings = response.json()["customer_portal_settings"]
        assert settings["customer"]["allow_email_change"] is True

    @pytest.mark.auth
    async def test_submit_for_review_requires_relevant_fields(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        update_response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "details": {
                    "product_description": "Too short",
                    "selling_categories": ["Software / SaaS"],
                    "pricing_models": ["Subscription"],
                    "switching": False,
                }
            },
        )
        assert update_response.status_code == 200

        response = await client.post(
            f"/v1/organizations/{organization.id}/submit-review"
        )

        assert response.status_code == 422
        error_locations = {tuple(error["loc"]) for error in response.json()["detail"]}
        assert ("body", "website") in error_locations
        assert ("body", "email") in error_locations
        assert ("body", "socials") in error_locations
        assert ("body", "details", "product_description") in error_locations

    @pytest.mark.auth
    async def test_submit_for_review_requires_details(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        update_response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "website": "https://example.com",
                "email": "support@example.com",
                "socials": [{"platform": "x", "url": "https://x.com/polar"}],
            },
        )
        assert update_response.status_code == 200

        response = await client.post(
            f"/v1/organizations/{organization.id}/submit-review"
        )

        assert response.status_code == 422
        error_locations = {tuple(error["loc"]) for error in response.json()["detail"]}
        assert ("body", "details", "product_description") in error_locations

    @pytest.mark.auth
    async def test_submit_for_review_valid(
        self,
        client: AsyncClient,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        organization.status = OrganizationStatus.CREATED
        await save_fixture(organization)

        update_response = await client.patch(
            f"/v1/organizations/{organization.id}",
            json={
                "website": "https://example.com",
                "email": "support@example.com",
                "socials": [{"platform": "x", "url": "https://x.com/polar"}],
                "details": {
                    "product_description": "Subscription SaaS for software teams and agencies.",
                    "selling_categories": ["Software / SaaS"],
                    "pricing_models": ["Subscription"],
                    "switching": False,
                },
            },
        )
        assert update_response.status_code == 200

        response = await client.post(
            f"/v1/organizations/{organization.id}/submit-review"
        )

        assert response.status_code == 200
        assert response.json()["details_submitted_at"] is not None
        enqueue_job_mock.assert_called_once()

    @pytest.mark.auth
    async def test_submit_for_review_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(f"/v1/organizations/{uuid.uuid4()}/submit-review")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestInviteOrganization:
    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/organizations/{uuid.uuid4()}", json={})

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_inviter_not_part_of_org(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        # user_organization: UserOrganization,
    ) -> None:
        members_before = await user_organization_service.list_by_org(
            session, organization.id
        )
        response = await client.post(
            f"/v1/organizations/{organization.id}/members/invite",
            json={"email": "test@polar.sh"},
        )
        assert response.status_code == 404

        members_after = await user_organization_service.list_by_org(
            session, organization.id
        )

        assert set(members_after) == set(members_before)

    @pytest.mark.auth
    @pytest.mark.keep_session_state
    async def test_inviter_part_of_org(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,  # Makes this user part of the organization
    ) -> None:
        email_to_invite = "test@polar.sh"

        members_before = await user_organization_service.list_by_org(
            session, organization.id
        )
        response = await client.post(
            f"/v1/organizations/{organization.id}/members/invite",
            json={"email": email_to_invite},
        )
        assert response.status_code == 201
        json = response.json()
        assert json["email"] == email_to_invite

        members_after = await user_organization_service.list_by_org(
            session, organization.id
        )

        new_members = set(members_after) - set(members_before)
        assert len(new_members) == 1
        assert list(new_members)[0].user.email == email_to_invite

    @pytest.mark.auth
    @pytest.mark.keep_session_state
    async def test_already_invited(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        user_organization_second: UserOrganization,  # second user part of this org
    ) -> None:
        email_already_in_org = user_organization_second.user.email

        members_before = await user_organization_service.list_by_org(
            session, organization.id
        )
        assert len(members_before) == 2

        response = await client.post(
            f"/v1/organizations/{organization.id}/members/invite",
            json={"email": email_already_in_org},
        )
        assert response.status_code == 200
        json = response.json()
        assert json["email"] == email_already_in_org

        members_after = await user_organization_service.list_by_org(
            session, organization.id
        )

        assert set(members_after) == set(members_before)
        assert len(members_after) == 2


@pytest.mark.asyncio
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
@pytest.mark.auth
async def test_list_members_not_member(
    session: AsyncSession,
    organization: Organization,
    # user_organization: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    client: AsyncClient,
) -> None:
    response = await client.get(f"/v1/organizations/{organization.id}/members")

    assert response.status_code == 404


@pytest.mark.asyncio
class TestGetPaymentStatus:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/payment-status"
        )
        assert response.status_code == 200
        json = response.json()
        assert "payment_ready" in json
        assert "organization_status" in json

    @pytest.mark.auth
    async def test_valid_grandfathered_organization(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Make organization grandfathered
        organization.created_at = datetime(2025, 8, 4, 8, 0, tzinfo=UTC)
        await save_fixture(organization)

        response = await client.get(
            f"/v1/organizations/{organization.id}/payment-status"
        )
        assert response.status_code == 200

        json = response.json()
        # Should be payment ready even without completing steps
        assert json["payment_ready"] is True


@pytest.mark.asyncio
class TestSetPayoutAccount:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/payout-account",
            json={"payout_account_id": str(uuid.uuid4())},
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_non_member_returns_404(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}/payout-account",
            json={"payout_account_id": str(uuid.uuid4())},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_non_admin_member_returns_403(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        """A regular org member (not admin) cannot set the payout account."""
        other_user = await create_user(save_fixture)
        organization.account = await create_account(save_fixture, user=other_user)
        await save_fixture(organization)

        payout_account = await create_payout_account(save_fixture, organization, user)
        organization.payout_account = None
        await save_fixture(organization)

        response = await client.patch(
            f"/v1/organizations/{organization.id}/payout-account",
            json={"payout_account_id": str(payout_account.id)},
        )
        assert response.status_code == 403

    @pytest.mark.auth
    async def test_admin_can_set_own_payout_account(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        """An org admin can set the payout account to one they own."""
        organization.account = await create_account(save_fixture, user=user)
        await save_fixture(organization)

        payout_account = await create_payout_account(save_fixture, organization, user)
        organization.payout_account = None
        await save_fixture(organization)

        response = await client.patch(
            f"/v1/organizations/{organization.id}/payout-account",
            json={"payout_account_id": str(payout_account.id)},
        )
        assert response.status_code == 200
        assert response.json()["id"] == str(organization.id)

    @pytest.mark.auth
    async def test_admin_cannot_set_other_users_payout_account(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        """An org admin cannot assign a payout account they don't own."""
        organization.account = await create_account(save_fixture, user=user)
        await save_fixture(organization)

        other_user = await create_user(save_fixture)
        payout_account = await create_payout_account(
            save_fixture, organization, other_user
        )
        organization.payout_account = None
        await save_fixture(organization)

        response = await client.patch(
            f"/v1/organizations/{organization.id}/payout-account",
            json={"payout_account_id": str(payout_account.id)},
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_unknown_payout_account_returns_422(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        organization.account = await create_account(save_fixture, user=user)
        await save_fixture(organization)

        response = await client.patch(
            f"/v1/organizations/{organization.id}/payout-account",
            json={"payout_account_id": str(uuid.uuid4())},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestDeleteOrganization:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.delete(f"/v1/organizations/{organization.id}")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.delete(f"/v1/organizations/{organization.id}")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.delete(f"/v1/organizations/{uuid.uuid4()}")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid_no_activity(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        # Mock the enqueue_job to prevent actual task execution
        mock_enqueue = mocker.patch("polar.organization.service.enqueue_job")

        response = await client.delete(f"/v1/organizations/{organization.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is True
        assert json["requires_support"] is False
        assert json["blocked_reasons"] == []

        # Ensure no background task was enqueued (immediate deletion)
        mock_enqueue.assert_not_called()

    @pytest.mark.auth
    async def test_blocked_has_orders(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        # Create a customer and order for this organization
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
            stripe_customer_id="STRIPE_CUSTOMER_ID",
        )
        await create_order(save_fixture, customer=customer, product=product)

        # Mock the enqueue_job to prevent actual task execution
        mock_enqueue = mocker.patch("polar.organization.service.enqueue_job")

        response = await client.delete(f"/v1/organizations/{organization.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is False
        assert json["requires_support"] is True
        assert "has_orders" in json["blocked_reasons"]

        # Ensure background task was enqueued for support ticket
        mock_enqueue.assert_called_once()

    @pytest.mark.auth
    async def test_blocked_has_active_subscriptions(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        # Create a customer and active subscription for this organization
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
            stripe_customer_id="STRIPE_CUSTOMER_ID",
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        # Mock the enqueue_job to prevent actual task execution
        mock_enqueue = mocker.patch("polar.organization.service.enqueue_job")

        response = await client.delete(f"/v1/organizations/{organization.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is False
        assert json["requires_support"] is True
        assert "has_active_subscriptions" in json["blocked_reasons"]

        # Ensure background task was enqueued for support ticket
        mock_enqueue.assert_called_once()

    @pytest.mark.auth
    async def test_valid_with_payout_account_deletion(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        stripe_payout_account: Account,
        user_organization: UserOrganization,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        # Mock payout account deletion to succeed (returns None on success)
        payout_account_delete_mock = mocker.patch(
            "polar.organization.service.payout_account_service.delete",
            return_value=None,
        )
        mock_enqueue = mocker.patch("polar.organization.service.enqueue_job")

        response = await client.delete(f"/v1/organizations/{organization.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is True
        assert json["requires_support"] is False
        assert json["blocked_reasons"] == []

        # Payout account should have been deleted
        payout_account_delete_mock.assert_called_once()
        # No background task should be enqueued (immediate deletion)
        mock_enqueue.assert_not_called()

    @pytest.mark.auth
    async def test_payout_account_deletion_failure(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        stripe_payout_account: Account,
        user_organization: UserOrganization,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        # Mock payout account deletion to fail with an exception
        # Mock payout account deletion to succeed (returns None on success)
        payout_account_delete_mock = mocker.patch(
            "polar.organization.service.payout_account_service.delete",
            side_effect=PayoutAccountServiceError("Stripe account deletion failed"),
        )
        mock_enqueue = mocker.patch("polar.organization.service.enqueue_job")

        response = await client.delete(f"/v1/organizations/{organization.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["deleted"] is False
        assert json["requires_support"] is True
        assert "stripe_account_deletion_failed" in json["blocked_reasons"]

        # Payout account deletion should have been attempted
        payout_account_delete_mock.assert_called_once()
        # Background task should be enqueued for support ticket
        mock_enqueue.assert_called_once()

    @pytest.mark.auth
    async def test_not_admin_with_account(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        # Create an account with a different admin (not the current user)
        other_user = User(
            email="other@example.com",
        )
        await save_fixture(other_user)

        organization.account = await create_account(save_fixture, user=other_user)
        await save_fixture(organization)

        response = await client.delete(f"/v1/organizations/{organization.id}")

        assert response.status_code == 403
        json = response.json()
        assert json["detail"] == "Only the account admin can delete the organization"


@pytest.mark.asyncio
class TestGetReview:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/review")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/review")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Returns the checklist shape: a flat list of leaf checks."""
        response = await client.get(f"/v1/organizations/{organization.id}/review")

        assert response.status_code == 200
        json = response.json()

        assert [step["key"] for step in json["preliminary_steps"]] == [
            "identity.email",
            "identity.social_links",
            "identity.stripe_identity_verification",
            "product_description",
            "payout_account",
        ]

    @pytest.mark.auth
    async def test_empty_org_blocks_submission(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """A freshly created org with no details has every check pending."""
        response = await client.get(f"/v1/organizations/{organization.id}/review")

        assert response.status_code == 200
        json = response.json()
        assert json["can_submit"] is False
        assert json["submitted_at"] is None
        assert json["verdict"] is None
        assert json["appeal"] is None
        assert all(step["status"] == "pending" for step in json["preliminary_steps"])
        assert all(
            "not_started" in step["reasons"] for step in json["preliminary_steps"]
        )
