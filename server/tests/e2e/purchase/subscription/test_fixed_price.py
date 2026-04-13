"""
E2E: Subscription purchase — fixed price.

Monthly recurring product: checkout → payment → subscription active + order.
"""

import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, EmailCapture, StripeSimulator
from tests.e2e.purchase.conftest import BUYER_EMAIL, complete_purchase


@pytest.mark.asyncio
class TestSubscriptionFixedPrice:
    @E2E_AUTH
    async def test_full_flow(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        email_capture: EmailCapture,
        drain: DrainFn,
        organization: Organization,
        monthly_product: Product,
    ) -> None:
        # Given a $15/month recurring product
        # When the customer subscribes
        result = await complete_purchase(
            client,
            session,
            stripe_sim,
            drain,
            organization,
            monthly_product,
            amount=1500,
        )

        # Then the subscription is active with a matching order
        response = await client.get(f"/v1/checkouts/{result.checkout_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "succeeded"

        assert result.order["product"]["id"] == str(monthly_product.id)
        assert result.order["amount"] == 1500
        assert result.order["billing_reason"] == "subscription_create"
        assert result.order["subscription"] is not None

        response = await client.get("/v1/subscriptions/")
        assert response.status_code == 200
        subs = response.json()
        assert subs["pagination"]["total_count"] == 1
        sub = subs["items"][0]
        assert sub["status"] == "active"
        assert sub["product"]["id"] == str(monthly_product.id)
        assert sub["recurring_interval"] == "month"

        assert len(email_capture.find(to=BUYER_EMAIL)) >= 1
