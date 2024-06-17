from datetime import datetime

import pytest
from httpx import AsyncClient

from polar.models import Organization, Product, User, UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearchSubscriptions:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get("/api/v1/subscriptions/subscriptions/search")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/search",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid_organization(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        response = await client.get(
            "/api/v1/subscriptions/subscriptions/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" in item
            assert "github_username" in item["user"]
            assert "email" in item["user"]
