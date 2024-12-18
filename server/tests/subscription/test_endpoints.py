from datetime import datetime

import pytest
from httpx import AsyncClient

from polar.models import Customer, Organization, Product, UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription


@pytest.mark.asyncio
class TestListSubscriptions:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get("/v1/subscriptions/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        response = await client.get("/v1/subscriptions/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" in item
            assert "customer" in item
            assert item["user"]["id"] == item["customer"]["id"]
