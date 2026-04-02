"""
E2E: One-time purchase — happy path.

Checkout creation → payment confirmation → Stripe webhook →
order verified → email delivered.
"""

import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, EmailCapture, StripeSimulator
from tests.e2e.purchase.conftest import BILLING_ADDRESS, BUYER_EMAIL, BUYER_NAME


@pytest.mark.asyncio
class TestOneTimePurchaseHappyPath:
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
        product = one_time_product

        # ── Create checkout ──────────────────────────────────────────
        response = await client.post(
            "/v1/checkouts/",
            json={"products": [str(product.id)]},
        )
        assert response.status_code == 201, response.text
        checkout_data = response.json()
        assert checkout_data["status"] == "open"
        checkout_id = checkout_data["id"]
        client_secret = checkout_data["client_secret"]

        # Processes: checkout.created system event
        await drain()

        # ── Confirm checkout (payment) ───────────────────────────────
        stripe_sim.expect_payment(
            amount=2500,
            customer_name=BUYER_NAME,
            customer_email=BUYER_EMAIL,
            billing_address=BILLING_ADDRESS,
        )
        response = await client.post(
            f"/v1/checkouts/client/{client_secret}/confirm",
            json={
                "confirmation_token_id": "tok_test_confirm",
                "customer_email": BUYER_EMAIL,
                "customer_billing_address": BILLING_ADDRESS,
            },
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "confirmed"

        # Processes: customer.created, customer.webhook
        await drain()

        # ── Stripe charge.succeeded webhook ──────────────────────────
        await stripe_sim.send_charge_webhook(
            session, organization_id=organization.id, checkout_id=checkout_id
        )

        # Processes: charge.succeeded → checkout success → order → email
        executed = await drain()

        # ── Verify ───────────────────────────────────────────────────
        response = await client.get(f"/v1/checkouts/{checkout_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "succeeded"

        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 1
        order = orders["items"][0]
        assert order["product"]["id"] == str(product.id)
        assert order["amount"] == 2500
        assert order["currency"] == "usd"
        assert order["billing_reason"] == "purchase"

        assert len(email_capture.find(to=BUYER_EMAIL)) >= 1
        assert "stripe.webhook.charge.succeeded" in executed
        assert "order.confirmation_email" in executed
