"""
E2E: Lifecycle — subscription renewal.

An active subscription reaches the end of its billing period.
The scheduler enqueues subscription.cycle → billing entries created →
order.create_subscription_order runs → new order with billing_reason=subscription_cycle.
"""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from polar.models.subscription import SubscriptionStatus
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn
from tests.e2e.lifecycle.conftest import trigger_subscription_cycle
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_subscription


@pytest.mark.asyncio
class TestRenewal:
    @E2E_AUTH
    async def test_subscription_cycle_creates_order(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        drain: DrainFn,
        organization: Organization,
        monthly_product: Product,
    ) -> None:
        """
        Active subscription → scheduler triggers cycle → new order created.
        """
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="subscriber@example.com",
            stripe_customer_id="cus_e2e_renewal",
        )

        now = datetime.now(UTC)
        subscription = await create_subscription(
            save_fixture,
            product=monthly_product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=now - timedelta(days=30),
            current_period_start=now - timedelta(days=30),
            current_period_end=now,  # Period ends now → ready for cycle
        )

        # Simulate the scheduler triggering subscription.cycle
        executed = await trigger_subscription_cycle(session, drain, subscription.id)

        # Order was created for the new billing period
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 1
        order = orders["items"][0]
        assert order["product"]["id"] == str(monthly_product.id)
        assert order["amount"] == 1500
        assert order["billing_reason"] == "subscription_cycle"

        # Key tasks ran through the drain pipeline
        assert "subscription.cycle" in executed
        assert "order.create_subscription_order" in executed
