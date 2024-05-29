from datetime import datetime

import pytest
from httpx import AsyncClient

from polar.models import Organization, Product, User, UserOrganization
from polar.postgres import AsyncSession
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


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreateFreeSubscription:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription_tier_free: Product,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/subscriptions/",
            json={
                "tier_id": str(subscription_tier_free.id),
                "customer_email": "backer@example.com",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["product_id"] == str(subscription_tier_free.id)


@pytest.mark.asyncio
class TestSearchSubscriptionsSummary:
    @pytest.mark.http_auto_expunge
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/summary",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 422

    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user: User,
        product: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        response = await client.get(
            "/api/v1/subscriptions/subscriptions/summary",
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
            assert item["user"]["public_name"] != user.email
            assert "email" not in item["user"]
            assert "product" in item
            assert item["product"]["id"] == str(product.id)
            assert "status" not in item
            assert "price_amount" not in item


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetSubscriptionsStatistics:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/statistics",
            params={
                "platform": "github",
                "organization_name": organization.name,
                "start_date": "2023-01-01",
                "end_date": "2023-12-31",
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/statistics",
            params={
                "platform": "github",
                "organization_name": "not_existing",
                "start_date": "2023-01-01",
                "end_date": "2023-12-31",
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        products: list[Product],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/statistics",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "start_date": "2023-01-01",
                "end_date": "2023-12-31",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12
