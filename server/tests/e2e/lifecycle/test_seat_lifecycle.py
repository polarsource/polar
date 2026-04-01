"""
E2E: Lifecycle — seat-based subscription with volume pricing.

Subscribe with 3 seats (Tier 1, $10/seat) → upgrade to 8 seats (Tier 2, $8/seat)
with proration → renew → downgrade to 4 seats (Tier 1) with credit → renew.
Verifies billing entries, exact proration amounts, and order totals.

Volume pricing tiers:
  Tier 1:  1–5  seats  @ $10/seat
  Tier 2:  6–10 seats  @ $8/seat
  Tier 3:  11+  seats  @ $5/seat
"""

from datetime import UTC, datetime
from decimal import Decimal

import freezegun
import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from polar.models.billing_entry import (
    BillingEntryDirection,
    BillingEntryType,
)
from tests.e2e.conftest import E2E_AUTH, complete_purchase
from tests.e2e.infra import StripeSimulator
from tests.e2e.infra.task_drain import DrainFn
from tests.e2e.lifecycle.conftest import (
    get_billing_entries,
    trigger_subscription_cycle,
)


@pytest.mark.asyncio
class TestSeatSubscriptionLifecycle:
    @E2E_AUTH
    async def test_upgrade_renew_downgrade_renew(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        seat_org: Organization,
        seat_product: Product,
    ) -> None:
        jan1 = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC)
        jan16 = datetime(2025, 1, 16, 12, 0, 0, tzinfo=UTC)
        feb1 = datetime(2025, 2, 1, 12, 0, 0, tzinfo=UTC)
        feb15 = datetime(2025, 2, 15, 12, 0, 0, tzinfo=UTC)
        mar1 = datetime(2025, 3, 1, 12, 0, 0, tzinfo=UTC)

        # ── January 1st: Subscribe with 3 seats (Tier 1: $10/seat = $30) ─
        with freezegun.freeze_time(jan1):
            purchase = await complete_purchase(
                client,
                session,
                stripe_sim,
                drain,
                seat_org,
                seat_product,
                amount=3000,
                seats=3,
            )
            assert purchase.order["amount"] == 3000
            assert purchase.order["billing_reason"] == "subscription_create"

            response = await client.get("/v1/subscriptions/")
            assert response.status_code == 200
            subs = response.json()
            assert subs["pagination"]["total_count"] == 1
            sub = subs["items"][0]
            assert sub["status"] == "active"
            subscription_id = sub["id"]

        # ── January 16th: Upgrade to 8 seats (Tier 2: $8/seat = $64) ─────
        with freezegun.freeze_time(jan16):
            response = await client.patch(
                f"/v1/subscriptions/{subscription_id}",
                json={"seats": 8, "proration_behavior": "prorate"},
            )
            assert response.status_code == 200
            sub_data = response.json()
            assert sub_data["seats"] == 8

            increase_entries = await get_billing_entries(
                session, subscription_id, BillingEntryType.subscription_seats_increase
            )
            assert len(increase_entries) == 1
            assert increase_entries[0].direction == BillingEntryDirection.debit
            assert increase_entries[0].amount is not None
            assert increase_entries[0].amount > 0

            # Delta: 6400 - 3000 = 3400
            # Remaining: Jan 16 12:00 → Feb 1 12:00 = 16 days out of 31
            expected_proration = int(
                Decimal(3400) * Decimal(16 * 86400) / Decimal(31 * 86400)
            )
            assert increase_entries[0].amount == expected_proration

        # ── February 1st: First renewal (cycle + upgrade proration) ───────
        with freezegun.freeze_time(feb1):
            await trigger_subscription_cycle(session, drain, subscription_id)

            response = await client.get("/v1/orders/")
            assert response.status_code == 200
            orders = response.json()
            assert orders["pagination"]["total_count"] == 2

            renewal_1 = next(
                o
                for o in orders["items"]
                if o["billing_reason"] == "subscription_cycle"
            )
            assert renewal_1["amount"] == 6400 + expected_proration

        # ── February 15th: Downgrade to 4 seats (Tier 1: $10/seat = $40) ─
        with freezegun.freeze_time(feb15):
            response = await client.patch(
                f"/v1/subscriptions/{subscription_id}",
                json={"seats": 4, "proration_behavior": "prorate"},
            )
            assert response.status_code == 200
            sub_data = response.json()
            assert sub_data["seats"] == 4

            decrease_entries = await get_billing_entries(
                session, subscription_id, BillingEntryType.subscription_seats_decrease
            )
            assert len(decrease_entries) == 1
            assert decrease_entries[0].direction == BillingEntryDirection.credit
            assert decrease_entries[0].amount is not None
            assert decrease_entries[0].amount > 0

            # Delta: 4000 - 6400 = -2400
            # Remaining: Feb 15 12:00 → Mar 1 12:00 = 14 days out of 28
            expected_credit = abs(
                int(Decimal(-2400) * Decimal(14 * 86400) / Decimal(28 * 86400))
            )
            assert expected_credit == 1200
            assert decrease_entries[0].amount == expected_credit

        # ── March 1st: Second renewal (cycle - downgrade credit) ──────────
        with freezegun.freeze_time(mar1):
            await trigger_subscription_cycle(session, drain, subscription_id)

            response = await client.get("/v1/orders/")
            assert response.status_code == 200
            orders = response.json()
            assert orders["pagination"]["total_count"] == 3

            cycle_orders = sorted(
                [
                    o
                    for o in orders["items"]
                    if o["billing_reason"] == "subscription_cycle"
                ],
                key=lambda o: o["created_at"],
            )
            renewal_2 = cycle_orders[-1]
            assert renewal_2["amount"] == 4000 - expected_credit
            assert renewal_2["amount"] == 2800

        # ── Final assertions ──────────────────────────────────────────────
        billing_reasons = [o["billing_reason"] for o in orders["items"]]
        assert billing_reasons.count("subscription_create") == 1
        assert billing_reasons.count("subscription_cycle") == 2
