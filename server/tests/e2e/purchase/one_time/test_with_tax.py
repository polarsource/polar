"""
E2E: One-time purchase — with non-zero tax.

Verifies that tax is calculated, added to the charge amount, and
recorded on the order. Uses exclusive tax (added on top of price).
"""

from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.enums import TaxBehavior, TaxProcessor
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, Product
from polar.tax.calculation import TaxabilityReason
from tests.e2e.conftest import E2E_AUTH
from tests.e2e.infra import DrainFn, EmailCapture, StripeSimulator
from tests.e2e.purchase.conftest import BILLING_ADDRESS, BUYER_EMAIL, BUYER_NAME
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest_asyncio.fixture
async def taxed_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        name="E2E Taxed Widget",
        prices=[(5000, "usd")],  # $50.00
    )


@pytest.mark.asyncio
class TestWithTax:
    @E2E_AUTH
    async def test_tax_applied_to_order(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        email_capture: EmailCapture,
        drain: DrainFn,
        organization: Organization,
        mock_tax_calculation: MagicMock,
        taxed_product: Product,
    ) -> None:
        # Given a $50 product with 10% exclusive tax
        mock_tax_calculation.calculate.return_value = (
            {
                "processor_id": "TAX_E2E_10PCT",
                "amount": 500,  # $5 tax on $50
                "tax_behavior": TaxBehavior.exclusive,
                "tax_breakdown": [
                    {
                        "rate_type": "percentage",
                        "rate": 0.1,  # 10%
                        "display_name": "Tax",
                        "country": "US",
                        "state": "CA",
                        "subdivision": None,
                        "amount": 500,
                        "taxability_reason": TaxabilityReason.standard_rated,
                    }
                ],
            },
            TaxProcessor.numeral,
        )

        # When the customer purchases it (charged $55 = $50 + $5 tax)
        response = await client.post(
            "/v1/checkouts/",
            json={"products": [str(taxed_product.id)]},
        )
        assert response.status_code == 201, response.text
        checkout_id = response.json()["id"]
        client_secret = response.json()["client_secret"]
        await drain()

        stripe_sim.expect_payment(
            amount=5500,  # $50 + $5 tax
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
            session,
            organization_id=organization.id,
            checkout_id=checkout_id,
            tax_amount=500,
            tax_country="US",
        )
        await drain()

        # Then the order includes the correct tax
        response = await client.get("/v1/orders/")
        assert response.status_code == 200
        orders = response.json()
        assert orders["pagination"]["total_count"] == 1
        order = orders["items"][0]
        assert order["amount"] == 5000  # net amount (subtotal)
        assert order["tax_amount"] == 500  # $5 tax

        assert len(email_capture.find(to=BUYER_EMAIL)) >= 1
