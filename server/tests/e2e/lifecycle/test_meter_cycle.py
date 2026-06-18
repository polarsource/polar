"""
E2E: Lifecycle — meter cycle decoupled from the billing cycle.

A product billed yearly with a monthly meter cycle. The subscription's usage
clock fires monthly (well before the yearly billing boundary); the scheduler
picks it up via SubscriptionJobStore → enqueues subscription.cycle →
cycle_meters settles the month's overage as a subscription_meter_cycle
order, computing the overage from real ingested usage events.
"""

from decimal import Decimal

import freezegun
import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization
from polar.worker import JobQueueManager
from tests.e2e.infra import DrainFn, SchedulerSimulator, StripeSimulator
from tests.e2e.purchase.conftest import complete_purchase
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_meter,
    create_product,
)

PURCHASE_DATE = "2024-01-15 12:00:00"
METER_BOUNDARY = "2024-02-15 12:00:01"  # one month later — meter clock, not billing

BASE_AMOUNT = 1500  # $15 / year base price
UNIT_AMOUNT_CENTS = 100  # $1 per metered unit
USAGE_UNITS = 3  # $3 overage — clears the $0.50 minimum

_USAGE_AUTH = pytest.mark.auth(
    AuthSubjectFixture(
        subject="user",
        scopes={
            Scope.checkouts_read,
            Scope.checkouts_write,
            Scope.orders_read,
            Scope.subscriptions_read,
            Scope.subscriptions_write,
            Scope.events_write,
        },
    )
)


@pytest.mark.asyncio
class TestUsageCycle:
    @_USAGE_AUTH
    async def test_monthly_meter_cycle_settles_overage(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        meter = await create_meter(save_fixture, organization=organization)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
            meter_interval=SubscriptionRecurringInterval.month,
            prices=[
                (BASE_AMOUNT, "usd"),
                (meter, Decimal(UNIT_AMOUNT_CENTS), None, "usd"),
            ],
            is_tax_applicable=False,
        )

        # Purchase: charges the yearly base, creates a subscription with a monthly
        # meter clock.
        with freezegun.freeze_time(PURCHASE_DATE):
            purchase = await complete_purchase(
                client,
                session,
                stripe_sim,
                drain,
                organization,
                product,
                amount=BASE_AMOUNT,
            )
            customer_id = purchase.order["customer_id"]

            # Ingest metered usage (each event = 1 unit via the count meter).
            response = await client.post(
                "/v1/events/ingest",
                json={
                    "events": [
                        {
                            "name": METER_TEST_EVENT,
                            "customer_id": customer_id,
                            "organization_id": str(organization.id),
                        }
                        for _ in range(USAGE_UNITS)
                    ]
                },
            )
            assert response.status_code == 200, response.text
            await drain(ignored_actors={"email.send"})

            # Turn ingested events into pending metered billing entries.
            JobQueueManager.set()
            JobQueueManager.get().enqueue_job("meter.billing_entries", meter.id)
            await session.flush()
            await drain(ignored_actors={"email.send"})

        # One month later the meter clock fires (the yearly billing clock is in 2025).
        with freezegun.freeze_time(METER_BOUNDARY):
            assert await scheduler_sim.get_due_count() == 1, (
                "Expected the subscription to be due at the monthly meter cycle boundary"
            )

            async def _drain(**_kwargs: object) -> object:
                return await drain(ignored_actors={"email.send"})

            await scheduler_sim.trigger_due_cycles(_drain)  # type: ignore[arg-type]

        # A meter-cycle order should have settled the 3 units of overage ($3).
        response = await client.get("/v1/orders/", params={"limit": 10})
        assert response.status_code == 200
        meter_cycle_orders = [
            o
            for o in response.json()["items"]
            if o["billing_reason"] == "subscription_meter_cycle"
        ]
        assert len(meter_cycle_orders) == 1, (
            f"Expected one meter-cycle order, got {len(meter_cycle_orders)}"
        )
        assert (
            meter_cycle_orders[0]["subtotal_amount"] == USAGE_UNITS * UNIT_AMOUNT_CENTS
        )

        # The billing period is still the original year; only the meter clock moved.
        response = await client.get("/v1/subscriptions/")
        sub = response.json()["items"][0]
        assert sub["current_period_start"].startswith("2024-01-15")
        assert sub["current_meter_period_start"].startswith("2024-02-15")
