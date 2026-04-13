"""
E2E: One-time purchase — free product.

Free products skip Stripe entirely. The checkout confirm triggers
handle_free_success directly (no payment intent, no webhook).
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import Organization, Product
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, EmailCapture
from tests.e2e.purchase.conftest import BILLING_ADDRESS, BUYER_EMAIL, BUYER_NAME
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest_asyncio.fixture
async def free_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        name="E2E Free Guide",
        prices=[(None, "usd")],  # None = free
    )


@pytest.mark.asyncio
class TestFreeProduct:
    @E2E_AUTH
    async def test_no_payment_required(
        self,
        client: AsyncClient,
        email_capture: EmailCapture,
        drain: DrainFn,
        organization: Organization,
        free_product: Product,
    ) -> None:
        # Given a free product
        response = await client.post(
            "/v1/checkouts/",
            json={"products": [str(free_product.id)]},
        )
        assert response.status_code == 201, response.text
        checkout_id = response.json()["id"]
        client_secret = response.json()["client_secret"]
        await drain()

        # When the customer confirms without a payment token
        response = await client.post(
            f"/v1/checkouts/client/{client_secret}/confirm",
            json={
                "customer_email": BUYER_EMAIL,
                "customer_name": BUYER_NAME,
                "customer_billing_address": BILLING_ADDRESS,
            },
        )
        assert response.status_code == 200, response.text
        # No Stripe webhook needed — free checkout completes via background task
        await drain()

        # Then the checkout succeeds and a $0 order is created
        response = await client.get(f"/v1/checkouts/{checkout_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "succeeded"

        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 1
        assert orders["items"][0]["amount"] == 0
        assert orders["items"][0]["billing_reason"] == "purchase"

        assert len(email_capture.find(to=BUYER_EMAIL)) >= 1
