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
from polar.subscription.repository import SubscriptionRepository
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, StripeSimulator
from tests.e2e.lifecycle.conftest import trigger_subscription_cycle
from tests.e2e.purchase.conftest import complete_purchase


@pytest.mark.asyncio
class TestRenewal:
    @E2E_AUTH
    async def test_subscription_cycle_creates_order(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        organization: Organization,
        monthly_product: Product,
    ) -> None:
        # Given an active subscription created via a real purchase
        purchase = await complete_purchase(
            client,
            session,
            stripe_sim,
            drain,
            organization,
            monthly_product,
            amount=1500,
        )

        # Get the subscription and advance its period end to now
        response = await client.get("/v1/subscriptions/")
        assert response.status_code == 200
        subs = response.json()
        assert subs["pagination"]["total_count"] == 1
        subscription_id = subs["items"][0]["id"]

        # Simulate time passing: set period end to now so cycle triggers
        sub_repo = SubscriptionRepository.from_session(session)
        subscription = await sub_repo.get_by_id(
            subscription_id, options=sub_repo.get_eager_options()
        )
        assert subscription is not None
        now = datetime.now(UTC)
        subscription.current_period_start = now - timedelta(days=30)
        subscription.current_period_end = now
        await session.flush()

        # When the scheduler triggers the cycle
        await trigger_subscription_cycle(session, drain, subscription.id)

        # Then a renewal order is created (in addition to the original purchase order)
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 2

        # Most recent order is the renewal
        billing_reasons = {o["billing_reason"] for o in orders["items"]}
        assert "subscription_create" in billing_reasons
        assert "subscription_cycle" in billing_reasons

        renewal_order = next(
            o for o in orders["items"] if o["billing_reason"] == "subscription_cycle"
        )
        assert renewal_order["product"]["id"] == str(monthly_product.id)
        assert renewal_order["amount"] == 1500
