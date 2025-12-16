import uuid

import pytest
from httpx import AsyncClient

from polar.models import Customer, Organization, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_canceled_subscription,
    create_product,
)


@pytest.mark.asyncio
class TestCustomerSubscriptionProductUpdate:
    async def test_anonymous(
        self, client: AsyncClient, session: AsyncSession, subscription: Subscription
    ) -> None:
        non_existing = uuid.uuid4()
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(product_id=str(non_existing)),
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_non_existing_product(
        self, client: AsyncClient, session: AsyncSession, subscription: Subscription
    ) -> None:
        non_existing = uuid.uuid4()
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(product_id=str(non_existing)),
        )
        assert response.status_code == 422

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_non_recurring_product(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(product_id=str(product.id)),
        )
        assert response.status_code == 422

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_extraneous_tier(
        self,
        client: AsyncClient,
        subscription: Subscription,
        product_organization_second: Product,
    ) -> None:
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(product_id=str(product_organization_second.id)),
        )
        assert response.status_code == 422

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    @pytest.mark.keep_session_state
    async def test_valid(
        self,
        client: AsyncClient,
        subscription: Subscription,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        product_second: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(product_id=str(product_second.id)),
        )

        assert response.status_code == 200
        updated_subscription = response.json()
        assert updated_subscription["product"]["id"] == str(product_second.id)


@pytest.mark.asyncio
class TestCustomerSubscriptionUpdateCancel:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_id=True,
            ),
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_tampered(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer_second: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer_second,
        )
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_id=True,
            ),
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        reason = "too_complex"
        comment = "Too many settings"

        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=True,
                cancellation_reason=reason,
                cancellation_comment=comment,
            ),
        )

        assert response.status_code == 200
        updated_subscription = response.json()
        current_period_end = updated_subscription["current_period_end"]
        assert updated_subscription["id"] == str(subscription.id)
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["cancel_at_period_end"]
        assert updated_subscription["ends_at"] == current_period_end
        assert updated_subscription["customer_cancellation_reason"] == reason
        assert updated_subscription["customer_cancellation_comment"] == comment


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
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=False,
            ),
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_tampered(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product_organization_second: Product,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product_organization_second,
            customer=customer_second,
        )
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=False,
            ),
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_uncancel_revoked(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture, product=product, customer=customer, revoke=True
        )
        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
            json=dict(
                cancel_at_period_end=False,
            ),
        )
        assert response.status_code == 410

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        response = await client.patch(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
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
class TestCustomerSubscriptionCancel:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        response = await client.delete(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
        )
        assert response.status_code == 401

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_tampered(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer_second: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer_second,
        )

        response = await client.delete(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
        )
        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        response = await client.delete(
            f"/v1/customer-portal/subscriptions/{subscription.id}",
        )

        assert response.status_code == 200
        updated_subscription = response.json()
        current_period_end = updated_subscription["current_period_end"]
        assert updated_subscription["id"] == str(subscription.id)
        assert updated_subscription["status"] == SubscriptionStatus.active
        assert updated_subscription["ended_at"] is None
        assert updated_subscription["cancel_at_period_end"]
        assert updated_subscription["ends_at"] == current_period_end
