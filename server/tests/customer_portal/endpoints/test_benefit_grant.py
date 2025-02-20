import pytest
from httpx import AsyncClient

from polar.models import Benefit, Customer, Subscription
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit_grant


@pytest.mark.asyncio
class TestListBenefitGrants:
    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_customer(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        await create_benefit_grant(
            save_fixture,
            customer_second,
            benefit_organization_second,
            granted=False,
            subscription=subscription,
        )

        response = await client.get("/v1/customer-portal/benefit-grants/")

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1
