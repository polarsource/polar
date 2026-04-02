"""
E2E: Lifecycle — subscription renewal.

An active subscription reaches the end of its billing period.
The cycle method creates billing entries and enqueues an order creation
task. After draining, a new order exists with billing_reason=subscription_cycle.
"""

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from polar.models.subscription import SubscriptionStatus
from polar.subscription.service import subscription as subscription_service
from tests.e2e.infra import DrainFn
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_product,
    create_subscription,
)

E2E_LIFECYCLE_AUTH = pytest.mark.auth(
    AuthSubjectFixture(
        subject="user",
        scopes={
            Scope.web_read,
            Scope.web_write,
            Scope.orders_read,
            Scope.subscriptions_read,
        },
    )
)


@pytest_asyncio.fixture
async def monthly_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        name="E2E Monthly Plan",
        prices=[(1500, "usd")],
    )


@pytest.mark.asyncio
class TestRenewal:
    @E2E_LIFECYCLE_AUTH
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
        An active subscription cycles → billing entry created →
        order.create_subscription_order task runs → new order exists.
        """
        # ── Set up: active subscription with period ending now ────────
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

        # ── Cycle the subscription ───────────────────────────────────
        # This is what the scheduler calls when current_period_end is reached.
        subscription = await subscription_service.cycle(session, subscription)
        await session.flush()

        # Processes: order.create_subscription_order → order creation → email
        executed = await drain()

        # ── Verify ───────────────────────────────────────────────────

        # Subscription period advanced
        assert subscription.current_period_start == now
        assert subscription.current_period_end > now

        # New order was created
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 1
        order = orders["items"][0]
        assert order["product"]["id"] == str(monthly_product.id)
        assert order["amount"] == 1500
        assert order["billing_reason"] == "subscription_cycle"

        # Renewal task ran
        assert "order.create_subscription_order" in executed
