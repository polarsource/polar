"""
E2E: One-time purchase — payment failure.

When a charge fails, no order should be created and the checkout
should return to open status so the customer can retry.
"""

import pytest
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, StripeSimulator
from tests.e2e.infra.stripe_simulator import simulate_webhook
from tests.e2e.purchase.conftest import BILLING_ADDRESS, BUYER_EMAIL, BUYER_NAME
from tests.fixtures.stripe import build_stripe_charge


@pytest.mark.asyncio
class TestPaymentFailure:
    @E2E_AUTH
    async def test_no_order_created_on_failed_charge(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        organization: Organization,
        one_time_product: Product,
    ) -> None:
        # Given a checkout that has been confirmed
        response = await client.post(
            "/v1/checkouts/",
            json={"products": [str(one_time_product.id)]},
        )
        assert response.status_code == 201, response.text
        checkout_id = response.json()["id"]
        client_secret = response.json()["client_secret"]
        await drain()

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
        await drain()

        # When the charge fails
        failed_charge = build_stripe_charge(
            status="failed",
            amount=2500,
            customer=stripe_sim.customer_id,
            payment_intent=stripe_sim.payment_intent_id,
            metadata={
                "type": "product",
                "organization_id": str(organization.id),
                "checkout_id": checkout_id,
                "tax_amount": "0",
                "tax_country": "US",
            },
            billing_details={
                "name": BUYER_NAME,
                "email": BUYER_EMAIL,
                "address": BILLING_ADDRESS,
            },
            payment_method_details={
                "type": "card",
                "card": {
                    "brand": "visa",
                    "last4": "4242",
                    "exp_month": 12,
                    "exp_year": 2030,
                    "country": "US",
                },
            },
            outcome={
                "network_status": "declined_by_network",
                "type": "issuer_declined",
                "reason": "insufficient_funds",
                "seller_message": "The card was declined.",
            },
        )
        failed_charge["object"] = "charge"
        failed_charge["payment_method"] = "pm_e2e_test"

        await simulate_webhook(session, "charge.failed", failed_charge)
        await drain()

        # Then no order is created
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        assert response.json()["pagination"]["total_count"] == 0

        # And the checkout returns to open so the customer can retry
        response = await client.get(f"/v1/checkouts/{checkout_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "open"
