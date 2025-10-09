import uuid
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.enums import SubscriptionRecurringInterval
from polar.models import Customer, CustomerSeat, Organization, Subscription
from polar.postgres import AsyncSession
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
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

        # Ensure changes are committed
        await session.commit()
        await session.refresh(subscription)

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
