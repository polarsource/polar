import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from polar.enums import SubscriptionRecurringInterval
from polar.models import (
    Customer,
    Organization,
    Product,
    Subscription,
    UserOrganization,
)
from polar.models.customer_seat import SeatStatus
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_canceled_subscription,
    create_customer,
    create_customer_seat,
    create_product,
    create_subscription,
    create_subscription_with_seats,
)


@pytest.mark.asyncio
class TestListSubscriptions:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get("/v1/subscriptions/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        response = await client.get("/v1/subscriptions/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" in item
            assert "customer" in item
            assert item["user"]["id"] == item["customer"]["id"]

    @pytest.mark.auth
    async def test_metadata(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            user_metadata={"reference_id": "ABC"},
        )
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            user_metadata={"reference_id": "DEF"},
        )
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            user_metadata={"reference_id": "GHI"},
        )

        response = await client.get(
            "/v1/subscriptions/", params={"metadata[reference_id]": ["ABC", "DEF"]}
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2


@pytest.mark.asyncio
class TestCreateSubscription:
    async def test_anonymous(
        self,
        client: AsyncClient,
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        response = await client.post(
            "/v1/subscriptions/",
            json={
                "product_id": str(product_recurring_free_price.id),
                "customer_id": str(customer.id),
            },
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid_with_customer_id(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        response = await client.post(
            "/v1/subscriptions/",
            json={
                "product_id": str(product_recurring_free_price.id),
                "customer_id": str(customer.id),
            },
        )
        assert response.status_code == 201

        json = response.json()
        assert json["product_id"] == str(product_recurring_free_price.id)
        assert json["customer_id"] == str(customer.id)
        assert json["status"] == SubscriptionStatus.active
        assert "user" in json
        assert "customer" in json

    @pytest.mark.auth
    async def test_valid_with_external_customer_id(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_recurring_free_price: Product,
        organization: Organization,
        customer_external_id: Customer,
    ) -> None:
        response = await client.post(
            "/v1/subscriptions/",
            json={
                "product_id": str(product_recurring_free_price.id),
                "external_customer_id": customer_external_id.external_id,
            },
        )
        assert response.status_code == 201

        json = response.json()
        assert json["product_id"] == str(product_recurring_free_price.id)
        assert json["customer_id"] == str(customer_external_id.id)
        assert json["status"] == SubscriptionStatus.active

    @pytest.mark.auth
    async def test_valid_with_metadata(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        metadata = {"reference_id": "ABC123"}
        response = await client.post(
            "/v1/subscriptions/",
            json={
                "product_id": str(product_recurring_free_price.id),
                "customer_id": str(customer.id),
                "metadata": metadata,
            },
        )
        assert response.status_code == 201

        json = response.json()
        assert json["metadata"] == metadata


@pytest.mark.asyncio
class TestSubscriptionProductUpdate:
    async def test_anonymous(
        self, client: AsyncClient, session: AsyncSession, subscription: Subscription
    ) -> None:
        non_existing = uuid.uuid4()
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_price_id=str(non_existing)),
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_canceled_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        product: Product,
        product_second: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_id=str(product_second.id)),
        )
        assert response.status_code == 403

    @pytest.mark.auth
    async def test_non_existing_product(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        non_existing = uuid.uuid4()
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_id=str(non_existing)),
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_non_recurring_product(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        new_product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json={"product_id": str(new_product.id)},
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_extraneous_tier(
        self,
        client: AsyncClient,
        subscription: Subscription,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
        product_organization_second: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_id=str(product_organization_second.id)),
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        subscription: Subscription,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        product_second: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(product_id=str(product_second.id)),
        )
        assert response.status_code == 200
        updated_subscription = response.json()
        assert updated_subscription["product"]["id"] == str(product_second.id)


@pytest.mark.asyncio
class TestSubscriptionUpdateCancel:
    async def test_anonymous(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
                customer_cancellation_reason="too_expensive",
                customer_cancellation_comment="Inflation be crazy",
            ),
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_tampered(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product_organization_second: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
                customer_cancellation_reason="too_expensive",
                customer_cancellation_comment="Inflation be crazy",
            ),
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )

        reason = "too_expensive"
        comment = "Inflation be crazy"

        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
                customer_cancellation_reason=reason,
                customer_cancellation_comment=comment,
            ),
        )

        assert response.status_code == 200
        updated_subscription = response.json()
        current_period_end = updated_subscription["current_period_end"]
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["cancel_at_period_end"]
        assert updated_subscription["ends_at"] == current_period_end
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["customer_cancellation_reason"] == reason
        assert updated_subscription["customer_cancellation_comment"] == comment

    @pytest.mark.auth
    async def test_valid_past_due(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            status=SubscriptionStatus.past_due,
        )

        reason = "too_expensive"
        comment = "Inflation be crazy"

        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
                customer_cancellation_reason=reason,
                customer_cancellation_comment=comment,
            ),
        )

        assert response.status_code == 200
        updated_subscription = response.json()
        assert updated_subscription["status"] == SubscriptionStatus.past_due


@pytest.mark.asyncio
class TestSubscriptionUpdateUncancel:
    async def test_anonymous(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=False,
            ),
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_tampered(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product_organization_second: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product_organization_second,
            customer=customer,
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
            ),
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_uncancel_revoked(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture, product=product, customer=customer, revoke=True
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=False,
            ),
        )
        assert response.status_code == 410

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=False,
            ),
        )

        assert response.status_code == 200
        updated_subscription = response.json()
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["cancel_at_period_end"] is False
        assert updated_subscription["ends_at"] is None
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["customer_cancellation_reason"] is None
        assert updated_subscription["customer_cancellation_comment"] is None


@pytest.mark.asyncio
class TestSubscriptionUpdateRevoke:
    async def test_anonymous(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                revoke=True,
                customer_cancellation_reason="too_expensive",
                customer_cancellation_comment="Inflation be crazy",
            ),
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_tampered(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product_organization_second: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                revoke=True,
                customer_cancellation_reason="too_expensive",
                customer_cancellation_comment="Inflation be crazy",
            ),
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )

        reason = "too_expensive"
        comment = "Inflation be crazy"

        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(
                revoke=True,
                customer_cancellation_reason=reason,
                customer_cancellation_comment=comment,
            ),
        )

        assert response.status_code == 200
        updated_subscription = response.json()
        ended_at = updated_subscription["ended_at"]
        assert ended_at
        assert updated_subscription["status"] == SubscriptionStatus.canceled
        assert updated_subscription["cancel_at_period_end"] is False
        assert updated_subscription["ends_at"] == ended_at
        assert updated_subscription["customer_cancellation_reason"] == reason
        assert updated_subscription["customer_cancellation_comment"] == comment


@pytest.mark.asyncio
class TestSubscriptionRevoke:
    async def test_anonymous(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.delete(f"/v1/subscriptions/{subscription.id}")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_tampered(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product_organization_second: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )
        response = await client.delete(f"/v1/subscriptions/{subscription.id}")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
        )

        response = await client.delete(f"/v1/subscriptions/{subscription.id}")

        assert response.status_code == 200
        updated_subscription = response.json()
        assert updated_subscription["status"] == SubscriptionStatus.canceled


@pytest.mark.asyncio
class TestSubscriptionUpdateSeats:
    async def test_anonymous(
        self, client: AsyncClient, subscription: Subscription
    ) -> None:
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json={"seats": 10},
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_seat_increase(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with 5 seats
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
        )
        assert subscription.seats == 5
        assert subscription.amount == 5000

        # When: Increase to 10 seats
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json={"seats": 10},
        )

        # Then: Successfully updated
        assert response.status_code == 200
        updated = response.json()
        assert updated["seats"] == 10
        assert updated["amount"] == 10000

    @pytest.mark.auth
    async def test_seat_decrease(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with 10 seats, 3 assigned
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=10,
        )

        # Create 3 assigned seats
        for i in range(3):
            from tests.fixtures.random_objects import create_customer

            seat_customer = await create_customer(
                save_fixture,
                organization=organization,
                email=f"customer-{i}@example.com",
            )
            await create_customer_seat(
                save_fixture,
                subscription=subscription,
                status=SeatStatus.claimed,
                customer=seat_customer,
            )

        # When: Decrease to 5 seats (above assigned count)
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json={"seats": 5},
        )

        # Then: Successfully updated
        assert response.status_code == 200
        updated = response.json()
        assert updated["seats"] == 5
        assert updated["amount"] == 5000

    @pytest.mark.auth
    async def test_seat_decrease_blocked_by_assignments(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Given: Subscription with 10 seats, 7 assigned
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=10,
        )

        # Create 7 assigned seats
        for i in range(7):
            seat_customer = await create_customer(
                save_fixture,
                organization=organization,
                email=f"customer-{i}@example.com",
            )
            await create_customer_seat(
                save_fixture,
                subscription=subscription,
                status=SeatStatus.claimed,
                customer=seat_customer,
            )

        # When: Try to decrease to 5 seats
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json={"seats": 5},
        )

        # Then: Error response
        assert response.status_code == 400
        error = response.json()
        assert "7 seats are assigned" in error["detail"]

    @pytest.mark.auth
    async def test_not_seat_based_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        product: Product,  # This is a fixed price product
    ) -> None:
        # Given: Subscription without seat-based pricing
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        # When: Try to update seats
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json={"seats": 10},
        )

        # Then: Error response
        assert response.status_code == 400
        error = response.json()
        assert "not support seat-based pricing" in error["detail"]

    @pytest.mark.auth
    async def test_trialing_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        Test that updating seats on a trialing subscription succeeds.

        Seat updates are allowed during trial - no proration is created
        since the customer isn't being billed yet.
        """
        # Given: Trialing subscription with seats
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
            status=SubscriptionStatus.trialing,
            started_at=datetime.now(UTC),
            trial_start=datetime.now(UTC),
            trial_end=datetime.now(UTC) + timedelta(days=30),
        )

        # When: Update seats during trial
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json={"seats": 10},
        )

        # Then: Successfully updated
        assert response.status_code == 200
        updated = response.json()
        assert updated["seats"] == 10
        assert updated["amount"] == 10000


@pytest.mark.asyncio
class TestSubscriptionUpdateTrial:
    @pytest.mark.auth
    async def test_extend_trial_seat_based_subscription(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test that trial end date can be updated for seat-based subscriptions."""
        # Given: Trialing seat-based subscription
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000)],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=5,
            status=SubscriptionStatus.trialing,
            started_at=datetime.now(UTC),
            trial_start=datetime.now(UTC),
            trial_end=datetime.now(UTC) + timedelta(days=14),
        )

        # When: Extend trial by 30 days
        new_trial_end = datetime.now(UTC) + timedelta(days=44)
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json={"trial_end": new_trial_end.isoformat()},
        )

        # Then: Trial extended, seats preserved
        assert response.status_code == 200
        updated = response.json()
        assert updated["status"] == SubscriptionStatus.trialing
        assert updated["seats"] == 5
        assert updated["amount"] == 5000
        assert datetime.fromisoformat(updated["trial_end"]) == new_trial_end


@pytest.mark.asyncio
class TestSubscriptionUpdateBillingPeriod:
    async def test_anonymous(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        new_period_end = (datetime.now(UTC) + timedelta(days=365)).isoformat()
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(current_billing_period_end=new_period_end),
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_tampered(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product_organization_second: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product_organization_second, customer=customer
        )
        new_period_end = (datetime.now(UTC) + timedelta(days=365)).isoformat()
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(current_billing_period_end=new_period_end),
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid_extension(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        new_period_end = datetime.now(UTC) + timedelta(days=365)
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(current_billing_period_end=new_period_end.isoformat()),
        )

        assert response.status_code == 200
        updated_subscription = response.json()
        returned_period_end = datetime.fromisoformat(
            updated_subscription["current_period_end"]
        )
        assert returned_period_end == new_period_end
        assert updated_subscription["status"] == SubscriptionStatus.active

    @pytest.mark.auth
    async def test_cannot_set_earlier_period_end(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        future_end = datetime.now(UTC) + timedelta(days=365)
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            current_period_end=future_end,
        )

        earlier_date = (datetime.now(UTC) + timedelta(days=180)).isoformat()
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(current_billing_period_end=earlier_date),
        )

        assert response.status_code == 422
        error = response.json()
        assert "earlier than the current period end" in error["detail"][0]["msg"]

    @pytest.mark.auth
    async def test_revoked_subscription(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
            revoke=True,
        )

        new_period_end = (datetime.now(UTC) + timedelta(days=365)).isoformat()
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(current_billing_period_end=new_period_end),
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_cannot_extend_scheduled_cancellation(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
            revoke=False,
        )
        assert subscription.cancel_at_period_end is True

        new_period_end = datetime.now(UTC) + timedelta(days=365)
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(current_billing_period_end=new_period_end.isoformat()),
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_inactive_subscription_past_due(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        current_end = datetime.now(UTC) + timedelta(days=30)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            started_at=datetime(2023, 1, 1),
            current_period_end=current_end,
        )

        new_period_end = (datetime.now(UTC) + timedelta(days=365)).isoformat()
        response = await client.patch(
            f"/v1/subscriptions/{subscription.id}",
            json=dict(current_billing_period_end=new_period_end),
        )

        assert response.status_code == 403
