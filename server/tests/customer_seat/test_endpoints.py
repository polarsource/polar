import uuid
from datetime import datetime

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import (
    Customer,
    CustomerSeat,
    Subscription,
    UserOrganization,
)
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer

# Auth fixture with the required scopes for seat endpoints
SEAT_AUTH = AuthSubjectFixture(
    scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.subscriptions_read,
        Scope.subscriptions_write,
    }
)


@pytest.mark.asyncio
class TestListSeats:
    @pytest.mark.auth(SEAT_AUTH)
    async def test_list_seats_success(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        customer_seat_pending: CustomerSeat,
        user_organization_seat_enabled: UserOrganization,
    ):
        response = await client.get(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
        )

        assert response.status_code == 200
        data = response.json()
        assert "seats" in data
        assert "available_seats" in data
        assert "total_seats" in data
        assert len(data["seats"]) == 1
        assert data["available_seats"] == 4
        assert data["total_seats"] == 5

    @pytest.mark.auth(SEAT_AUTH)
    async def test_list_seats_subscription_not_found(
        self,
        client: AsyncClient,
        user_organization_seat_enabled: UserOrganization,
    ):
        import uuid

        fake_id = uuid.uuid4()
        response = await client.get(
            f"/v1/subscriptions/{fake_id}/seats",
        )

        assert response.status_code == 404

    @pytest.mark.auth(SEAT_AUTH)
    async def test_list_seats_feature_disabled(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user_organization: UserOrganization,
    ):
        subscription.started_at = datetime.now()
        await save_fixture(subscription)
        subscription.product.organization.feature_settings = {}
        await save_fixture(subscription.product.organization)

        response = await client.get(
            f"/v1/subscriptions/{subscription.id}/seats",
        )

        assert response.status_code == 403

    async def test_list_seats_unauthorized(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
    ):
        response = await client.get(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats"
        )

        assert response.status_code == 401


@pytest.mark.asyncio
class TestAssignSeat:
    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_with_email_success(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        user_organization_seat_enabled: UserOrganization,
    ):
        await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={"email": "test@example.com"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert data["subscription_id"] == str(subscription_with_seats.id)
        assert "invitation_token" not in data
        assert "customer" not in data

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_with_external_customer_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        user_organization_seat_enabled: UserOrganization,
    ):
        await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            external_id="ext123",
        )

        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={"external_customer_id": "ext123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_with_metadata(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        user_organization_seat_enabled: UserOrganization,
    ):
        await create_customer(
            save_fixture,
            organization=subscription_with_seats.product.organization,
            email="test@example.com",
        )

        metadata = {"role": "admin", "department": "engineering"}
        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={"email": "test@example.com", "metadata": metadata},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["seat_metadata"] == metadata

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_no_identifiers(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        user_organization_seat_enabled: UserOrganization,
    ):
        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={},
        )

        assert response.status_code == 422

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_multiple_identifiers(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        customer: Customer,
        user_organization_seat_enabled: UserOrganization,
    ):
        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={"email": "test@example.com", "customer_id": str(customer.id)},
        )

        assert response.status_code == 422

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_no_available_seats(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        user_organization_seat_enabled: UserOrganization,
    ):
        subscription_with_seats.seats = 0
        await save_fixture(subscription_with_seats)

        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={"email": "test@example.com"},
        )

        assert response.status_code == 400

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_customer_already_has_seat(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        customer_seat_claimed: CustomerSeat,
        customer: Customer,
        user_organization_seat_enabled: UserOrganization,
    ):
        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={"customer_id": str(customer.id)},
        )

        assert response.status_code == 400

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_subscription_not_found(
        self,
        client: AsyncClient,
        user_organization_seat_enabled: UserOrganization,
    ):
        fake_id = uuid.uuid4()
        response = await client.post(
            f"/v1/subscriptions/{fake_id}/seats",
            json={"email": "test@example.com"},
        )

        assert response.status_code == 404

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_feature_disabled(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        user_organization: UserOrganization,
    ):
        subscription.started_at = datetime.utcnow()
        await save_fixture(subscription)
        subscription.product.organization.feature_settings = {}
        await save_fixture(subscription.product.organization)

        response = await client.post(
            f"/v1/subscriptions/{subscription.id}/seats",
            json={"email": "test@example.com"},
        )

        assert response.status_code == 403

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_customer_not_found_email(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        user_organization_seat_enabled: UserOrganization,
    ):
        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={"email": "nonexistent@example.com"},
        )

        assert response.status_code == 404

    @pytest.mark.auth(SEAT_AUTH)
    async def test_assign_seat_customer_not_found_external_id(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        user_organization_seat_enabled: UserOrganization,
    ):
        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={"external_customer_id": "nonexistent123"},
        )

        assert response.status_code == 404

    async def test_assign_seat_unauthorized(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
    ):
        response = await client.post(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats",
            json={"email": "test@example.com"},
        )

        assert response.status_code == 401


@pytest.mark.asyncio
class TestRevokeSeat:
    @pytest.mark.auth(SEAT_AUTH)
    async def test_revoke_seat_success(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        customer_seat_claimed: CustomerSeat,
        user_organization_seat_enabled: UserOrganization,
    ):
        response = await client.delete(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats/{customer_seat_claimed.id}",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "revoked"
        assert data["revoked_at"] is not None
        assert data["customer_id"] is None

    @pytest.mark.auth(SEAT_AUTH)
    async def test_revoke_seat_pending(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        customer_seat_pending: CustomerSeat,
        user_organization_seat_enabled: UserOrganization,
    ):
        response = await client.delete(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats/{customer_seat_pending.id}",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "revoked"

    @pytest.mark.auth(SEAT_AUTH)
    async def test_revoke_seat_not_found(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        user_organization_seat_enabled: UserOrganization,
    ):
        import uuid

        fake_id = uuid.uuid4()
        response = await client.delete(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats/{fake_id}",
        )

        assert response.status_code == 404

    @pytest.mark.auth(SEAT_AUTH)
    async def test_revoke_seat_wrong_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription_with_seats: Subscription,
        customer_seat_claimed: CustomerSeat,
        user_organization_seat_enabled: UserOrganization,
    ):
        from tests.fixtures.random_objects import create_subscription_with_seats

        other_subscription = await create_subscription_with_seats(
            save_fixture,
            product=subscription_with_seats.product,
            customer=subscription_with_seats.customer,
            seats=3,
        )

        response = await client.delete(
            f"/v1/subscriptions/{other_subscription.id}/seats/{customer_seat_claimed.id}",
        )

        assert response.status_code == 404

    @pytest.mark.auth(SEAT_AUTH)
    async def test_revoke_seat_subscription_not_found(
        self,
        client: AsyncClient,
        customer_seat_claimed: CustomerSeat,
        user_organization_seat_enabled: UserOrganization,
    ):
        import uuid

        fake_id = uuid.uuid4()
        response = await client.delete(
            f"/v1/subscriptions/{fake_id}/seats/{customer_seat_claimed.id}",
        )

        assert response.status_code == 404

    @pytest.mark.auth(SEAT_AUTH)
    async def test_revoke_seat_feature_disabled(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer_seat_claimed: CustomerSeat,
        user_organization: UserOrganization,
    ):
        subscription.started_at = datetime.utcnow()
        await save_fixture(subscription)
        subscription.product.organization.feature_settings = {}
        await save_fixture(subscription.product.organization)

        response = await client.delete(
            f"/v1/subscriptions/{subscription.id}/seats/{customer_seat_claimed.id}",
        )

        assert response.status_code == 403

    async def test_revoke_seat_unauthorized(
        self,
        client: AsyncClient,
        subscription_with_seats: Subscription,
        customer_seat_claimed: CustomerSeat,
    ):
        response = await client.delete(
            f"/v1/subscriptions/{subscription_with_seats.id}/seats/{customer_seat_claimed.id}"
        )

        assert response.status_code == 401
