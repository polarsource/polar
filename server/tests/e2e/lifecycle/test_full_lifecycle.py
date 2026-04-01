"""
E2E: Lifecycle — subscription purchase, multi-renewal, cancel, revocation.

An active subscription is purchased, renewed twice, canceled mid-period,
and then the final cycle completes the cancellation and revokes benefits.
"""

from datetime import UTC, datetime

import freezegun
import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from polar.models.billing_entry import BillingEntryType
from tests.e2e.conftest import BUYER_EMAIL, E2E_AUTH, complete_purchase
from tests.e2e.infra import (
    DrainFn,
    EmailCapture,
    SchedulerSimulator,
    StripeSimulator,
)
from tests.e2e.lifecycle.conftest import get_benefit_grants, get_billing_entries


@pytest.mark.asyncio
class TestSubscriptionFullLifecycle:
    @E2E_AUTH
    async def test_subscribe_renew_cancel_revoke(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        email_capture: EmailCapture,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        monthly_product_with_benefit: Product,
    ) -> None:
        product = monthly_product_with_benefit
        benefit = product.benefits[0]

        jan1 = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC)
        feb1 = datetime(2025, 2, 1, 12, 0, 0, tzinfo=UTC)
        mar1 = datetime(2025, 3, 1, 12, 0, 0, tzinfo=UTC)
        apr1 = datetime(2025, 4, 1, 12, 0, 0, tzinfo=UTC)

        # ── January 1st: Purchase ────────────────────────────────
        with freezegun.freeze_time(jan1):
            purchase = await complete_purchase(
                client, session, stripe_sim, drain, organization, product, amount=1500
            )
            assert purchase.order["amount"] == 1500
            assert purchase.order["billing_reason"] == "subscription_create"

            response = await client.get("/v1/subscriptions/")
            assert response.status_code == 200
            subs = response.json()
            assert subs["pagination"]["total_count"] == 1
            sub = subs["items"][0]
            assert sub["status"] == "active"
            subscription_id = sub["id"]
            customer_id = sub["customer_id"]

            assert len(email_capture.find(to=BUYER_EMAIL)) >= 1

            grants = await get_benefit_grants(session, customer_id, benefit.id)
            assert len(grants) == 1
            assert grants[0].is_granted is True

        # ── February 1st: First renewal ──────────────────────────
        with freezegun.freeze_time(feb1):
            assert await scheduler_sim.get_due_count() == 1
            await scheduler_sim.trigger_due_cycles(drain)

            response = await client.get("/v1/orders/")
            assert response.status_code == 200
            assert response.json()["pagination"]["total_count"] == 2

            entries = await get_billing_entries(
                session, subscription_id, BillingEntryType.cycle
            )
            assert len(entries) == 1
            assert entries[0].amount == 1500
            assert entries[0].start_timestamp == feb1
            assert entries[0].end_timestamp == mar1

        # ── March 1st: Second renewal ────────────────────────────
        with freezegun.freeze_time(mar1):
            assert await scheduler_sim.get_due_count() == 1
            await scheduler_sim.trigger_due_cycles(drain)

            response = await client.get("/v1/orders/")
            assert response.status_code == 200
            assert response.json()["pagination"]["total_count"] == 3

            entries = await get_billing_entries(
                session, subscription_id, BillingEntryType.cycle
            )
            assert len(entries) == 2
            assert entries[1].start_timestamp == mar1
            assert entries[1].end_timestamp == apr1

        # ── March 15th: Cancel ───────────────────────────────────
        with freezegun.freeze_time(datetime(2025, 3, 15, 12, 0, 0, tzinfo=UTC)):
            response = await client.patch(
                f"/v1/subscriptions/{subscription_id}",
                json={"cancel_at_period_end": True},
            )
            assert response.status_code == 200
            sub_data = response.json()
            assert sub_data["status"] == "active"
            assert sub_data["cancel_at_period_end"] is True

            grants = await get_benefit_grants(session, customer_id, benefit.id)
            assert len(grants) == 1
            assert grants[0].is_granted is True

        # ── April 1st: Final cycle — cancellation completes ──────
        with freezegun.freeze_time(apr1):
            assert await scheduler_sim.get_due_count() == 1
            await scheduler_sim.trigger_due_cycles(drain)

            response = await client.get(f"/v1/subscriptions/{subscription_id}")
            assert response.status_code == 200
            assert response.json()["status"] == "canceled"

            grants = await get_benefit_grants(session, customer_id, benefit.id)
            assert len(grants) == 1
            assert grants[0].is_revoked is True

            # No new order for the canceled period — still 3 total
            response = await client.get("/v1/orders/")
            assert response.status_code == 200
            orders = response.json()
            assert orders["pagination"]["total_count"] == 3

            billing_reasons = {o["billing_reason"] for o in orders["items"]}
            assert "subscription_create" in billing_reasons
            assert "subscription_cycle" in billing_reasons
