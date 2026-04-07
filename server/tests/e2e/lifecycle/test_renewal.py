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
from polar.kit.utils import utc_now
from polar.models import Organization, Product
from polar.subscription.repository import SubscriptionRepository
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, SchedulerSimulator, StripeSimulator
from tests.e2e.purchase.conftest import complete_purchase

# Purchase happens on Jan 15 → monthly sub ends Feb 15
PURCHASE_DATE = "2024-01-15 12:00:00"
RENEWAL_DATE = "2024-02-15 12:00:01"  # Just past period end
BEFORE_RENEWAL_DATE = "2024-02-14 12:00:00"  # Before period end


@pytest.mark.asyncio
class TestRenewal:
    @E2E_AUTH
    async def test_subscription_cycle_creates_order(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        monthly_product: Product,
    ) -> None:
        # Given: purchase a monthly subscription with time frozen at Jan 15
        with freezegun.freeze_time(PURCHASE_DATE):
            purchase = await complete_purchase(
                client,
                session,
                stripe_sim,
                drain,
                organization,
                monthly_product,
                amount=1500,
            )

        # Verify subscription was created with correct period dates
        response = await client.get("/v1/subscriptions/")
        assert response.status_code == 200
        subs = response.json()
        assert subs["pagination"]["total_count"] == 1
        subscription_data = subs["items"][0]
        assert subscription_data["current_period_start"].startswith("2024-01-15")
        assert subscription_data["current_period_end"].startswith("2024-02-15")

        # When: time advances past the period end → scheduler picks it up
        with freezegun.freeze_time(RENEWAL_DATE):
            result = await scheduler_sim.trigger_due_cycles(drain)

        # Then: a renewal order is created (in addition to the original purchase)
        assert "subscription.cycle" in result

        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 2

        billing_reasons = {o["billing_reason"] for o in orders["items"]}
        assert "subscription_create" in billing_reasons
        assert "subscription_cycle" in billing_reasons

        renewal_order = next(
            o for o in orders["items"] if o["billing_reason"] == "subscription_cycle"
        )
        assert renewal_order["product"]["id"] == str(monthly_product.id)
        assert renewal_order["amount"] == 1500

    @E2E_AUTH
    async def test_scheduler_does_not_pick_before_period_end(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        monthly_product: Product,
    ) -> None:
        # Given: purchase a monthly subscription on Jan 15
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

        # When: time is still before the period end (Feb 14)
        with freezegun.freeze_time(BEFORE_RENEWAL_DATE):
            due_count = await scheduler_sim.get_due_count()

        # Then: the scheduler should NOT pick up the subscription
        assert due_count == 0

        # And only the original purchase order exists
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 1
        assert orders["items"][0]["billing_reason"] == "subscription_create"

    @E2E_AUTH
    async def test_scheduler_locks_subscription_during_cycle(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        monthly_product: Product,
    ) -> None:
        # Given: purchase a subscription and advance past period end
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

        response = await client.get("/v1/subscriptions/")
        subscription_id = response.json()["items"][0]["id"]

        with freezegun.freeze_time(RENEWAL_DATE):
            # Verify the subscription is due
            assert await scheduler_sim.get_due_count() == 1

            # Simulate the lock being set (as the scheduler would do)
            sub_repo = SubscriptionRepository.from_session(session)
            subscription = await sub_repo.get_by_id(subscription_id)
            assert subscription is not None
            subscription.scheduler_locked_at = utc_now()
            await session.flush()

            # Then: a second pick should NOT find it (locked)
            assert await scheduler_sim.get_due_count() == 0

        # Clean up: unlock and run the cycle so state is consistent
        subscription.scheduler_locked_at = None
        await session.flush()

        with freezegun.freeze_time(RENEWAL_DATE):
            await scheduler_sim.trigger_due_cycles(drain)

    @E2E_AUTH
    async def test_period_advances_after_cycle(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        monthly_product: Product,
    ) -> None:
        # Given: purchase and complete first renewal cycle
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

        with freezegun.freeze_time(RENEWAL_DATE):
            await scheduler_sim.trigger_due_cycles(drain)

        # Then: subscription period should have advanced to the next month
        response = await client.get("/v1/subscriptions/")
        assert response.status_code == 200
        sub = response.json()["items"][0]
        # After cycle: period_start = Feb 15, period_end = Mar 15
        assert sub["current_period_start"].startswith("2024-02-15")
        assert sub["current_period_end"].startswith("2024-03-15")

        # And the subscription should NOT be picked up at the current frozen time
        # since the period end has advanced past it
        with freezegun.freeze_time(RENEWAL_DATE):
            assert await scheduler_sim.get_due_count() == 0

        # But SHOULD be picked up after the next period end
        with freezegun.freeze_time("2024-03-15 12:00:01"):
            assert await scheduler_sim.get_due_count() == 1

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
