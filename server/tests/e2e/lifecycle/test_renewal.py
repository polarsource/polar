"""
E2E: Lifecycle — subscription renewal.

An active subscription reaches the end of its billing period.
The scheduler picks it up via SubscriptionJobStore → enqueues subscription.cycle →
billing entries created → order.create_subscription_order runs →
new order with billing_reason=subscription_cycle.

Uses freezegun to control time so the scheduler's cron job picker logic is
exercised with realistic time progression instead of manual date manipulation.
"""

import freezegun
import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, SchedulerSimulator, StripeSimulator
from tests.e2e.purchase.conftest import complete_purchase

# Purchase happens on Jan 15 → monthly sub ends Feb 15
PURCHASE_DATE = "2024-01-15 12:00:00"


@pytest.mark.asyncio
class TestRenewal:
    @E2E_AUTH
    async def test_multiple_cycles(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        monthly_product: Product,
    ) -> None:
        # Given: purchase a subscription
        with freezegun.freeze_time(PURCHASE_DATE):
            await complete_purchase(
                client,
                session,
                stripe_sim,
                drain,
                organization,
                monthly_product,
                amount=1500,
            )

        # Run 3 consecutive monthly cycles
        cycle_dates = [
            "2024-02-15 12:00:01",  # 1st renewal
            "2024-03-15 12:00:01",  # 2nd renewal
            "2024-04-15 12:00:01",  # 3rd renewal
        ]

        for cycle_date in cycle_dates:
            with freezegun.freeze_time(cycle_date):
                assert await scheduler_sim.get_due_count() == 1, (
                    f"Expected 1 due sub at {cycle_date}"
                )
                await scheduler_sim.trigger_due_cycles(drain)

        # Verify all orders exist: 1 creation + 3 renewals = 4 total
        response = await client.get("/v1/orders/", params={"limit": 10})
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 4

        cycle_orders = [
            o for o in orders["items"] if o["billing_reason"] == "subscription_cycle"
        ]
        assert len(cycle_orders) == 3

        # Subscription period should now be Apr 15 → May 15
        response = await client.get("/v1/subscriptions/")
        sub = response.json()["items"][0]
        assert sub["current_period_start"].startswith("2024-04-15")
        assert sub["current_period_end"].startswith("2024-05-15")
