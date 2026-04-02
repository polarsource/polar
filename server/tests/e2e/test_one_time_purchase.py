"""
E2E test: One-time product purchase flow.

Tests the complete purchase lifecycle:
  1. Create a product with a fixed price
  2. Create a checkout session via API
  3. Confirm checkout (simulating Stripe payment)
  4. Simulate Stripe charge.succeeded webhook
  5. Drain all background tasks
  6. Verify: order created, email sent, checkout succeeded
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.email_capture import EmailCapture
from tests.e2e.stripe_simulator import StripeSimulator
from tests.e2e.task_drain import DrainFn
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product

BUYER_EMAIL = "buyer@example.com"
BUYER_NAME = "Test Buyer"
BILLING_ADDRESS = {
    "country": "US",
    "city": "San Francisco",
    "postal_code": "94105",
    "line1": "123 Market St",
    "state": "CA",
}


@pytest_asyncio.fixture
async def one_time_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        name="E2E Widget",
        prices=[(2500, "usd")],
    )


@pytest.mark.asyncio
class TestOneTimePurchase:
    @E2E_AUTH
    async def test_full_purchase_flow(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        email_capture: EmailCapture,
        drain: DrainFn,
        organization: Organization,
        one_time_product: Product,
    ) -> None:
        """
        Complete one-time purchase: checkout creation -> confirmation ->
        Stripe webhook -> order + email verification.
        """
        product = one_time_product

        # ── Step 1: Create checkout via API ──────────────────────────
        response = await client.post(
            "/v1/checkouts/",
            json={"products": [str(product.id)]},
        )
        assert response.status_code == 201, response.text
        checkout_data = response.json()

        assert checkout_data["status"] == "open"
        assert checkout_data["product"]["id"] == str(product.id)
        checkout_id = checkout_data["id"]
        client_secret = checkout_data["client_secret"]

        # Processes: checkout.created system event
        await drain()

        # ── Step 2: Confirm checkout (simulates payment) ─────────────
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

        # ── Step 3: Simulate Stripe charge.succeeded webhook ─────────
        await stripe_sim.send_charge_webhook(
            session, organization_id=organization.id, checkout_id=checkout_id
        )

        # Processes: charge.succeeded → checkout success → order creation → email
        executed = await drain()

        # ── Step 4: Verify results ───────────────────────────────────

        # 4a. Checkout transitioned to succeeded
        response = await client.get(f"/v1/checkouts/{checkout_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "succeeded"

        # 4b. Order was created and is paid
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders_data = response.json()
        assert orders_data["pagination"]["total_count"] == 1

        order = orders_data["items"][0]
        assert order["product"]["id"] == str(product.id)
        assert order["amount"] == 2500
        assert order["currency"] == "usd"
        assert order["billing_reason"] == "purchase"

        # 4c. Confirmation email was sent to the buyer
        buyer_emails = email_capture.find(to=BUYER_EMAIL)
        assert len(buyer_emails) >= 1, (
            f"Expected email to {BUYER_EMAIL}, "
            f"got: {[e.to for e in email_capture.emails]}"
        )

        # 4d. Key background tasks were executed
        assert "stripe.webhook.charge.succeeded" in executed
        assert "order.confirmation_email" in executed
        assert "order.created" in executed
