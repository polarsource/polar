"""
E2E: One-time purchase — with percentage discount.

A 20% discount is applied at checkout. The order amount should
reflect the discounted price.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from polar.models.discount import DiscountDuration, DiscountPercentage, DiscountType
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, EmailCapture, StripeSimulator
from tests.e2e.purchase.conftest import BILLING_ADDRESS, BUYER_EMAIL, BUYER_NAME
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_discount, create_product


@pytest_asyncio.fixture
async def product_with_discount(
    save_fixture: SaveFixture, organization: Organization
) -> tuple[Product, DiscountPercentage]:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        name="E2E Premium Widget",
        prices=[(5000, "usd")],  # $50.00
    )
    discount = await create_discount(
        save_fixture,
        type=DiscountType.percentage,
        basis_points=2000,  # 20%
        duration=DiscountDuration.once,
        organization=organization,
        products=[product],
    )
    return product, discount


@pytest.mark.asyncio
class TestWithDiscount:
    @E2E_AUTH
    async def test_discount_applied_to_order(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        email_capture: EmailCapture,
        drain: DrainFn,
        organization: Organization,
        product_with_discount: tuple[Product, DiscountPercentage],
    ) -> None:
        product, discount = product_with_discount

        # ── Create checkout with discount ────────────────────────────
        response = await client.post(
            "/v1/checkouts/",
            json={
                "products": [str(product.id)],
                "discount_id": str(discount.id),
            },
        )
        assert response.status_code == 201, response.text
        checkout_data = response.json()
        checkout_id = checkout_data["id"]
        client_secret = checkout_data["client_secret"]
        # 20% off $50 = $10 discount, $40 net
        assert checkout_data["discount"]["id"] == str(discount.id)

        await drain()

        # ── Confirm ──────────────────────────────────────────────────
        stripe_sim.expect_payment(
            amount=4000,  # $40 after discount
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

        # ── Webhook ──────────────────────────────────────────────────
        await stripe_sim.send_charge_webhook(
            session, organization_id=organization.id, checkout_id=checkout_id
        )
        await drain()

        # ── Verify ───────────────────────────────────────────────────
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 1
        order = orders["items"][0]
        assert order["product"]["id"] == str(product.id)
        # Net amount = $50 - $10 discount = $40
        assert order["amount"] == 4000
        assert order["discount_amount"] == 1000

        assert len(email_capture.find(to=BUYER_EMAIL)) >= 1
