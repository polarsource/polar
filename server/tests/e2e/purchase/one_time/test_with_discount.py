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
from tests.e2e.purchase.conftest import BUYER_EMAIL, complete_purchase
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
        prices=[(5000, "usd")],
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

        # Given a $50 product with a 20% discount
        # When the customer purchases it
        result = await complete_purchase(
            client,
            session,
            stripe_sim,
            drain,
            organization,
            product,
            amount=4000,  # $50 - 20% = $40
            discount_id=str(discount.id),
        )

        # Then the order reflects the discounted price
        assert result.order["product"]["id"] == str(product.id)
        assert result.order["amount"] == 4000
        assert result.order["discount_amount"] == 1000

        assert len(email_capture.find(to=BUYER_EMAIL)) >= 1
