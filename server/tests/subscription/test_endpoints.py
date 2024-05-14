import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from polar.models import (
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_organization,
    create_product,
)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreateSubscribeSession:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={
                "tier_id": str(uuid.uuid4()),
                "price_id": str(uuid.uuid4()),
                "success_url": "https://polar.sh",
            },
        )

        assert response.status_code == 404

    @pytest.mark.parametrize("success_url", [None, "INVALID_URL"])
    async def test_missing_invalid_success_url(
        self,
        success_url: str | None,
        client: AsyncClient,
        product: Product,
    ) -> None:
        json = {
            "tier_id": str(product.id),
            "price_id": str(product.prices[0].id),
        }
        if success_url is not None:
            json["success_url"] = success_url

        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/", json=json
        )

        assert response.status_code == 422

    async def test_invalid_customer_email(
        self, client: AsyncClient, product: Product
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={
                "tier_id": str(product.id),
                "price_id": str(product.prices[0].id),
                "success_url": "https://polar.sh",
                "customer_email": "INVALID_EMAIL",
            },
        )

        assert response.status_code == 422

    async def test_anonymous_product_organization(
        self,
        client: AsyncClient,
        product: Product,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_subscription_checkout_session_mock: MagicMock = (
            stripe_service_mock.create_subscription_checkout_session
        )
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={
                "tier_id": str(product.id),
                "price_id": str(product.prices[0].id),
                "success_url": "https://polar.sh",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["id"] == "SESSION_ID"
        assert json["url"] == "STRIPE_URL"
        assert json["subscription_tier"]["id"] == str(product.id)
        assert json["price"]["id"] == str(product.prices[0].id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetSubscribeSession:
    async def test_valid_product_organization(
        self,
        client: AsyncClient,
        product: Product,
        stripe_service_mock: MagicMock,
    ) -> None:
        get_checkout_session_mock: MagicMock = stripe_service_mock.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={
                "subscription_tier_id": str(product.id),
                "subscription_tier_price_id": str(product.prices[0].id),
            },
        )

        response = await client.get(
            "/api/v1/subscriptions/subscribe-sessions/SESSION_ID"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == "SESSION_ID"
        assert json["url"] == "STRIPE_URL"
        assert json["customer_name"] == "John"
        assert json["customer_email"] == "backer@example.com"
        assert json["subscription_tier"]["id"] == str(product.id)
        assert json["price"]["id"] == str(product.prices[0].id)


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
class TestSearchSubscribedSubscriptions:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/subscriptions/subscriptions/subscribed")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/subscribed",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
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

        response = await client.get("/api/v1/subscriptions/subscriptions/subscribed")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" not in item

    @pytest.mark.auth
    async def test_valid_organization_member(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        organization_second: Organization,
        product: Product,
    ) -> None:
        """
        We were bitten by a bug where we resolved the organization from the user,
        but in this context, we shouldn't set an organization implicitly.
        """
        organization_second.is_personal = True
        await save_fixture(organization_second)
        user_organization = UserOrganization(
            user_id=user.id,
            organization_id=organization_second.id,
        )
        await save_fixture(user_organization)

        await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        response = await client.get("/api/v1/subscriptions/subscriptions/subscribed")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" not in item

    @pytest.mark.auth
    async def test_with_multiple_subscriptions(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        organization: Organization,
        product: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # subscribe to multiple orgs
        for _ in range(3):
            org1 = await create_organization(save_fixture)
            sub1 = await create_product(save_fixture, organization=org1)
            await create_active_subscription(
                save_fixture,
                product=sub1,
                user=user,
                started_at=datetime(2023, 1, 1),
                ended_at=datetime(2023, 6, 15),
            )

        response = await client.get(
            "/api/v1/subscriptions/subscriptions/subscribed",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" not in item


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
@pytest.mark.http_auto_expunge
class TestUpgradeSubscription:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription: Subscription,
        product_second: Product,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/subscriptions/{subscription.id}",
            json={
                "subscription_tier_id": str(product_second.id),
                "price_id": str(product_second.prices[0].id),
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(
        self,
        client: AsyncClient,
        product_second: Product,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/subscriptions/{uuid.uuid4()}",
            json={
                "subscription_tier_id": str(product_second.id),
                "price_id": str(product_second.prices[0].id),
            },
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        subscription: Subscription,
        product_second: Product,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/subscriptions/{subscription.id}",
            json={
                "subscription_tier_id": str(product_second.id),
                "price_id": str(product_second.prices[0].id),
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(subscription.id)


@pytest.mark.asyncio
class TestCancelSubscription:
    @pytest.mark.http_auto_expunge
    async def test_anonymous(
        self, client: AsyncClient, subscription: Subscription
    ) -> None:
        response = await client.delete(
            f"/api/v1/subscriptions/subscriptions/{subscription.id}"
        )

        assert response.status_code == 401

    @pytest.mark.auth
    @pytest.mark.http_auto_expunge
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.delete(
            f"/api/v1/subscriptions/subscriptions/{uuid.uuid4()}"
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        subscription: Subscription,
    ) -> None:
        subscription.status = SubscriptionStatus.active
        await save_fixture(subscription)

        # then
        session.expunge_all()

        response = await client.delete(
            f"/api/v1/subscriptions/subscriptions/{subscription.id}"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(subscription.id)


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
