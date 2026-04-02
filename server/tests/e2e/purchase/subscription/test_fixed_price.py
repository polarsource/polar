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
from tests.e2e.purchase.conftest import BILLING_ADDRESS, BUYER_EMAIL, BUYER_NAME


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
        product = monthly_product

        # Given a $15/month recurring product
        response = await client.post(
            "/v1/checkouts/",
            json={"products": [str(product.id)]},
        )
        assert response.status_code == 201, response.text
        checkout_id = response.json()["id"]
        client_secret = response.json()["client_secret"]
        await drain()

        # When the customer subscribes
        stripe_sim.expect_payment(
            amount=1500,
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
        await drain()

        await stripe_sim.send_charge_webhook(
            session, organization_id=organization.id, checkout_id=checkout_id
        )
        await drain()

        # Then the subscription is active with a matching order
        response = await client.get(f"/v1/checkouts/{checkout_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "succeeded"

        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 1
        order = orders["items"][0]
        assert order["product"]["id"] == str(product.id)
        assert order["amount"] == 1500
        assert order["billing_reason"] == "subscription_create"
        assert order["subscription"] is not None

        response = await client.get("/v1/subscriptions/")
        assert response.status_code == 200
        subs = response.json()
        assert subs["pagination"]["total_count"] == 1
        sub = subs["items"][0]
        assert sub["status"] == "active"
        assert sub["product"]["id"] == str(product.id)
        assert sub["recurring_interval"] == "month"

        assert len(email_capture.find(to=BUYER_EMAIL)) >= 1
