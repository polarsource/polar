"""
E2E: One-time purchase — fixed price.

Standard paid product: checkout → payment → Stripe webhook → order → email.
"""

import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, EmailCapture, StripeSimulator
from tests.e2e.purchase.conftest import BUYER_EMAIL, complete_purchase


@pytest.mark.asyncio
class TestOneTimeFixedPrice:
    @E2E_AUTH
    async def test_full_flow(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        email_capture: EmailCapture,
        drain: DrainFn,
        organization: Organization,
        one_time_product: Product,
    ) -> None:
        # Given a $25 one-time product
        # When the customer pays
        result = await complete_purchase(
            client,
            session,
            stripe_sim,
            drain,
            organization,
            one_time_product,
            amount=2500,
        )

        # Then the checkout succeeds, an order is created, and email is sent
        response = await client.get(f"/v1/checkouts/{result.checkout_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "succeeded"

        assert result.order["product"]["id"] == str(one_time_product.id)
        assert result.order["amount"] == 2500
        assert result.order["currency"] == "usd"
        assert result.order["billing_reason"] == "purchase"

        assert len(email_capture.find(to=BUYER_EMAIL)) >= 1
