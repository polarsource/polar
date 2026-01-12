import uuid
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture
from sqlalchemy.orm import attributes

from polar.enums import SubscriptionRecurringInterval
from polar.models import Customer, CustomerSeat, Organization, Subscription
from polar.postgres import AsyncSession
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order_with_seats,
    create_product,
    create_product_price_seat_unit,
    create_subscription_with_seats,
)


@pytest.fixture(autouse=True)
def email_sender_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock()
    mocker.patch("polar.customer_seat.service.send_seat_invitation_email", new=mock)
    return mock


@pytest.mark.asyncio
class TestListSeats:
    async def test_anonymous(
        self, client: AsyncClient, subscription: Subscription
    ) -> None:
        response = await client.get(
            "/v1/customer-portal/seats",
            params={"subscription_id": str(subscription.id)},
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_not_customer_subscription(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer_second: Customer,
    ) -> None:
        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription for a different customer
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer_second,
            seats=5,
        )

        response = await client.get(
            "/v1/customer-portal/seats",
            params={"subscription_id": str(subscription.id)},
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Enable seat-based pricing feature
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        response = await client.get(
            "/v1/customer-portal/seats",
            params={"subscription_id": str(subscription.id)},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_seats"] == 5
        assert data["available_seats"] == 5
        assert len(data["seats"]) == 0


@pytest.mark.asyncio
class TestAssignSeat:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/customer-portal/seats",
            json={
                "subscription_id": str(uuid.uuid4()),
                "email": "test@example.com",
            },
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_not_customer_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer_second: Customer,
    ) -> None:
        # Enable seat-based pricing feature
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription for a different customer
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer_second,
            seats=5,
        )

        response = await client.post(
            "/v1/customer-portal/seats",
            json={
                "subscription_id": str(subscription.id),
                "email": "test@example.com",
            },
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Enable seat-based pricing feature
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        # Create a customer to assign the seat to
        new_customer = Customer(
            email="newuser@example.com",
            organization_id=organization.id,
        )
        await save_fixture(new_customer)

        response = await client.post(
            "/v1/customer-portal/seats",
            json={
                "subscription_id": str(subscription.id),
                "email": "newuser@example.com",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["customer_email"] == "newuser@example.com"
        assert data["status"] == "pending"
        assert data["subscription_id"] == str(subscription.id)


@pytest.mark.asyncio
class TestRevokeSeat:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.delete(
            f"/v1/customer-portal/seats/{uuid.uuid4()}",
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_not_customer_seat(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        # Enable seat-based pricing feature
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription for different customer
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer_second,
            seats=5,
        )

        # Create a seat
        seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer_second.id,
            status="pending",
        )
        await save_fixture(seat)

        response = await client.delete(
            f"/v1/customer-portal/seats/{seat.id}",
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Enable seat-based pricing feature
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        # Create a seat
        seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer.id,
            status="pending",
        )
        await save_fixture(seat)

        response = await client.delete(
            f"/v1/customer-portal/seats/{seat.id}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(seat.id)
        assert data["status"] == "revoked"


@pytest.mark.asyncio
class TestResendInvitation:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/v1/customer-portal/seats/{uuid.uuid4()}/resend",
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_not_customer_seat(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        # Enable seat-based pricing feature
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription for different customer
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer_second,
            seats=5,
        )

        # Create a pending seat
        seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer_second.id,
            status="pending",
        )
        await save_fixture(seat)

        response = await client.post(
            f"/v1/customer-portal/seats/{seat.id}/resend",
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_not_pending(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Enable seat-based pricing feature
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        # Create a claimed seat
        seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer.id,
            status="claimed",
        )
        await save_fixture(seat)

        response = await client.post(
            f"/v1/customer-portal/seats/{seat.id}/resend",
        )
        assert response.status_code == 400

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Enable seat-based pricing feature
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        # Create a pending seat with invitation token
        seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer.id,
            status="pending",
            invitation_token="test-token-123",
        )
        await save_fixture(seat)

        response = await client.post(
            f"/v1/customer-portal/seats/{seat.id}/resend",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(seat.id)
        assert data["status"] == "pending"


@pytest.mark.asyncio
class TestListClaimedSubscriptions:
    async def test_anonymous(self, client: AsyncClient) -> None:
        """Verify that unauthenticated requests are rejected."""
        response = await client.get("/v1/customer-portal/seats/subscriptions")
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_empty_list(
        self,
        client: AsyncClient,
        customer: Customer,
    ) -> None:
        """Verify empty list when customer has no claimed seats."""
        response = await client.get("/v1/customer-portal/seats/subscriptions")
        assert response.status_code == 200
        data = response.json()
        assert data == []

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_only_claimed_seats_returned(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        """Verify only subscriptions with claimed seats are returned."""
        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription owned by different customer
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer_second,
            seats=5,
        )

        # Create a claimed seat for the authenticated customer
        claimed_seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer.id,
            status="claimed",
        )
        await save_fixture(claimed_seat)

        # Create a pending seat (should not be returned)
        pending_seat = CustomerSeat(
            subscription_id=subscription.id,
            status="pending",
        )
        await save_fixture(pending_seat)

        response = await client.get("/v1/customer-portal/seats/subscriptions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(subscription.id)
        assert data[0]["product"]["name"] == product.name
        assert data[0]["product"]["organization"]["name"] == organization.name

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_does_not_include_owned_subscriptions(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Verify owned subscriptions are not included in claimed list."""
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription owned by the authenticated customer
        owned_subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        response = await client.get("/v1/customer-portal/seats/subscriptions")
        assert response.status_code == 200
        data = response.json()
        # Should be empty because customer owns the subscription, not claiming a seat
        assert len(data) == 0

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_revoked_seats_not_returned(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        """Verify revoked seats are not included."""
        # Create a seat-based product
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        # Create subscription owned by different customer
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer_second,
            seats=5,
        )

        # Create a revoked seat
        revoked_seat = CustomerSeat(
            subscription_id=subscription.id,
            customer_id=customer.id,
            status="revoked",
        )
        await save_fixture(revoked_seat)

        response = await client.get("/v1/customer-portal/seats/subscriptions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_multiple_claimed_subscriptions(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        """Verify multiple claimed subscriptions are all returned."""
        # Create two seat-based products
        product1 = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product1)

        product2 = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product2)

        # Create subscriptions owned by different customer
        subscription1 = await create_subscription_with_seats(
            save_fixture,
            product=product1,
            customer=customer_second,
            seats=5,
        )

        subscription2 = await create_subscription_with_seats(
            save_fixture,
            product=product2,
            customer=customer_second,
            seats=3,
        )

        # Create claimed seats for both subscriptions
        claimed_seat1 = CustomerSeat(
            subscription_id=subscription1.id,
            customer_id=customer.id,
            status="claimed",
        )
        await save_fixture(claimed_seat1)

        claimed_seat2 = CustomerSeat(
            subscription_id=subscription2.id,
            customer_id=customer.id,
            status="claimed",
        )
        await save_fixture(claimed_seat2)

        response = await client.get("/v1/customer-portal/seats/subscriptions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        subscription_ids = {item["id"] for item in data}
        assert str(subscription1.id) in subscription_ids
        assert str(subscription2.id) in subscription_ids


@pytest.mark.asyncio
class TestListSeatsForOrder:
    """Test listing seats for order-based (one-time purchase) products."""

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_valid_order(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,  # One-time purchase
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        order = await create_order_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        response = await client.get(
            "/v1/customer-portal/seats",
            params={"order_id": str(order.id)},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_seats"] == 5
        assert data["available_seats"] == 5
        assert len(data["seats"]) == 0


@pytest.mark.asyncio
class TestAssignSeatForOrder:
    """Test assigning seats for order-based (one-time purchase) products."""

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_valid_order(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,  # One-time purchase
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        order = await create_order_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        new_customer = Customer(
            email="newuser@example.com",
            organization_id=organization.id,
        )
        await save_fixture(new_customer)

        response = await client.post(
            "/v1/customer-portal/seats",
            json={
                "order_id": str(order.id),
                "email": "newuser@example.com",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["customer_email"] == "newuser@example.com"
        assert data["status"] == "pending"
        assert data["order_id"] == str(order.id)
        assert data["subscription_id"] is None


@pytest.mark.asyncio
class TestRevokeSeatForOrder:
    """Test revoking seats for order-based (one-time purchase) products."""

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_valid_order(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        organization.feature_settings["seat_based_pricing_enabled"] = True
        attributes.flag_modified(organization, "feature_settings")
        await save_fixture(organization)

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,  # One-time purchase
            is_archived=False,
        )
        await create_product_price_seat_unit(save_fixture, product=product)

        order = await create_order_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )

        seat = CustomerSeat(
            order_id=order.id,
            customer_id=customer.id,
            status="pending",
        )
        await save_fixture(seat)

        response = await client.delete(
            f"/v1/customer-portal/seats/{seat.id}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(seat.id)
        assert data["status"] == "revoked"
