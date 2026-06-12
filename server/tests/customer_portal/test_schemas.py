import pytest
from pydantic import TypeAdapter

from polar.customer_portal.schemas.organization import CustomerProduct
from polar.kit.visibility import Visibility
from polar.models import Organization
from polar.product.schemas import Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, create_product, set_product_benefits


@pytest.mark.asyncio
class TestCustomerProduct:
    async def test_excludes_non_public_benefits(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        public_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            description="Public benefit",
        )
        private_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            description="Private benefit",
        )
        private_benefit.visibility = Visibility.private
        await save_fixture(private_benefit)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
        )
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=[public_benefit, private_benefit],
        )

        adapter: TypeAdapter[CustomerProduct] = TypeAdapter(CustomerProduct)
        customer_product = adapter.validate_python(product, from_attributes=True)

        assert [benefit.description for benefit in customer_product.benefits] == [
            "Public benefit"
        ]

    async def test_merchant_product_schema_includes_private_benefits(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        public_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            description="Public benefit",
        )
        private_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            description="Private benefit",
        )
        private_benefit.visibility = Visibility.private
        await save_fixture(private_benefit)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
        )
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=[public_benefit, private_benefit],
        )

        adapter: TypeAdapter[Product] = TypeAdapter(Product)
        merchant_product = adapter.validate_python(product, from_attributes=True)

        assert {benefit.description for benefit in merchant_product.benefits} == {
            "Public benefit",
            "Private benefit",
        }
