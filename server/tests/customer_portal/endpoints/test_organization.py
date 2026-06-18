import pytest
from httpx import AsyncClient

from polar.kit.visibility import Visibility
from polar.models import Organization, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, set_product_benefits


@pytest.mark.asyncio
class TestGetOrganization:
    async def test_excludes_non_public_benefits(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        public_benefit = await create_benefit(
            save_fixture, organization=organization, description="Public benefit"
        )
        private_benefit = await create_benefit(
            save_fixture, organization=organization, description="Private benefit"
        )
        private_benefit.visibility = Visibility.private
        await save_fixture(private_benefit)
        await set_product_benefits(
            save_fixture,
            product=product,
            benefits=[public_benefit, private_benefit],
        )

        response = await client.get(
            f"/v1/customer-portal/organizations/{organization.slug}"
        )

        assert response.status_code == 200

        json = response.json()
        product_data = next(
            item for item in json["products"] if item["id"] == str(product.id)
        )
        benefit_ids = {benefit["id"] for benefit in product_data["benefits"]}
        assert str(public_benefit.id) in benefit_ids
        assert str(private_benefit.id) not in benefit_ids
