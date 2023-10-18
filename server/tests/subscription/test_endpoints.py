import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from polar.models import (
    Account,
    Organization,
    Repository,
    SubscriptionGroup,
    SubscriptionTier,
    User,
    UserOrganization,
)


@pytest.mark.asyncio
class TestSearchSubscriptionGroups:
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/groups/search",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 404

    async def test_not_existing_repository(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/groups/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": "not_existing",
            },
        )

        assert response.status_code == 404

    async def test_anonymous_organization(
        self,
        client: AsyncClient,
        organization: Organization,
        subscription_groups: list[SubscriptionGroup],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/groups/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1

        items = json["items"]
        assert items[0]["id"] == str(subscription_groups[0].id)

    async def test_anonymous_indirect_organization(
        self,
        client: AsyncClient,
        organization: Organization,
        subscription_groups: list[SubscriptionGroup],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/groups/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "direct_organization": False,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2

        items = json["items"]
        assert items[0]["id"] == str(subscription_groups[0].id)
        assert items[1]["id"] == str(subscription_groups[1].id)

    async def test_anonymous_public_repository(
        self,
        client: AsyncClient,
        organization: Organization,
        public_repository: Repository,
        subscription_groups: list[SubscriptionGroup],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/groups/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": public_repository.name,
                "direct_organization": False,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1

        items = json["items"]
        assert items[0]["repository_id"] == str(public_repository.id)

    async def test_anonymous_private_repository(
        self,
        client: AsyncClient,
        organization: Organization,
        repository: Repository,
        subscription_groups: list[SubscriptionGroup],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/groups/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": repository.name,
                "direct_organization": False,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    async def test_included_subscription_tiers(
        self,
        client: AsyncClient,
        organization: Organization,
        subscription_groups: list[SubscriptionGroup],
        subscription_tiers: list[SubscriptionTier],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/groups/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1

        items = json["items"]
        assert len(items[0]["tiers"]) == 1
        for tier in items[0]["tiers"]:
            assert "id" in tier


@pytest.mark.asyncio
class TestLookupSubscriptionGroup:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/groups/lookup",
            params={"subscription_group_id": str(uuid.uuid4())},
        )

        assert response.status_code == 404

    async def test_valid(
        self, client: AsyncClient, subscription_group_organization: SubscriptionGroup
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/groups/lookup",
            params={"subscription_group_id": str(subscription_group_organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(subscription_group_organization.id)


@pytest.mark.asyncio
class TestInitializeSubscriptionGroups:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/subscriptions/groups/initialize",
            json={"organization_id": str(uuid.uuid4())},
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_neither_organization_or_repository(
        self, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/groups/initialize",
            json={},
        )

        assert response.status_code == 422

    @pytest.mark.authenticated
    async def test_both_organization_and_repository(
        self,
        client: AsyncClient,
        organization: Organization,
        public_repository: Repository,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/groups/initialize",
            json={
                "organization_id": str(organization.id),
                "repository_id": str(public_repository.id),
            },
        )

        assert response.status_code == 422

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/groups/initialize",
            json={"organization_id": str(organization.id)},
        )

        assert response.status_code == 201


@pytest.mark.asyncio
class TestUpdateSubscriptionGroup:
    async def test_anonymous(
        self, client: AsyncClient, subscription_group_organization: SubscriptionGroup
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/groups/{subscription_group_organization.id}",
            json={"name": "Updated Subscription Group"},
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/groups/{uuid.uuid4()}",
            json={"name": "Updated Subscription Group"},
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_not_accessible(
        self, client: AsyncClient, subscription_group_organization: SubscriptionGroup
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/groups/{subscription_group_organization.id}",
            json={"name": "Updated Subscription Group"},
        )

        assert response.status_code == 403

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_group_organization: SubscriptionGroup,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/groups/{subscription_group_organization.id}",
            json={"name": "Updated Subscription Group"},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["name"] == "Updated Subscription Group"


@pytest.mark.asyncio
class TestLookupSubscriptionTier:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/lookup",
            params={"subscription_tier_id": str(uuid.uuid4())},
        )

        assert response.status_code == 404

    async def test_valid(
        self, client: AsyncClient, subscription_tier_organization: SubscriptionTier
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/lookup",
            params={"subscription_tier_id": str(subscription_tier_organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(subscription_tier_organization.id)


@pytest.mark.asyncio
class TestCreateSubscriptionTier:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/subscriptions/tiers/",
            json={
                "name": "Subscription Tier",
                "price_amount": 1000,
                "subscription_group_id": str(uuid.uuid4()),
            },
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_group_organization: SubscriptionGroup,
        user_organization_admin: UserOrganization,
        mock_stripe_service: MagicMock,
    ) -> None:
        create_product_with_price_mock: MagicMock = (
            mock_stripe_service.create_product_with_price
        )
        create_product_with_price_mock.return_value = SimpleNamespace(
            stripe_id="PRODUCT_ID", default_price="PRICE_ID"
        )

        response = await client.post(
            "/api/v1/subscriptions/tiers/",
            json={
                "name": "Subscription Tier",
                "price_amount": 1000,
                "subscription_group_id": str(subscription_group_organization.id),
            },
        )

        assert response.status_code == 201


@pytest.mark.asyncio
class TestUpdateSubscriptionTier:
    async def test_anonymous(
        self, client: AsyncClient, subscription_tier_organization: SubscriptionTier
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}",
            json={"name": "Updated Subscription Tier"},
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{uuid.uuid4()}",
            json={"name": "Updated Subscription Tier"},
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}",
            json={"name": "Updated Subscription Tier"},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["name"] == "Updated Subscription Tier"


@pytest.mark.asyncio
class TestArchiveSubscriptionTier:
    async def test_anonymous(
        self, client: AsyncClient, subscription_tier_organization: SubscriptionTier
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}/archive"
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{uuid.uuid4()}/archive"
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}/archive"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["is_archived"]


@pytest.mark.asyncio
class TestCreateSubscribeSession:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={"tier_id": str(uuid.uuid4()), "success_url": "https://polar.sh"},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize("success_url", [None, "INVALID_URL"])
    async def test_missing_invalid_success_url(
        self,
        success_url: str | None,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        json = {"tier_id": str(subscription_tier_organization.id)}
        if success_url is not None:
            json["success_url"] = success_url

        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/", json=json
        )

        assert response.status_code == 422

    async def test_invalid_customer_email(
        self, client: AsyncClient, subscription_tier_organization: SubscriptionTier
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={
                "tier_id": str(subscription_tier_organization.id),
                "success_url": "https://polar.sh",
                "customer_email": "INVALID_EMAIL",
            },
        )

        assert response.status_code == 422

    async def test_no_payout_account(
        self, client: AsyncClient, subscription_tier_organization: SubscriptionTier
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={
                "tier_id": str(subscription_tier_organization.id),
                "success_url": "https://polar.sh",
            },
        )

        assert response.status_code == 400

    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        mock_stripe_service: MagicMock,
        organization_account: Account,
    ) -> None:
        create_subscription_checkout_session_mock: MagicMock = (
            mock_stripe_service.create_subscription_checkout_session
        )
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            stripe_id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
        )

        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={
                "tier_id": str(subscription_tier_organization.id),
                "success_url": "https://polar.sh",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["id"] == "SESSION_ID"
        assert json["url"] == "STRIPE_URL"
        assert json["subscription_tier"]["id"] == str(subscription_tier_organization.id)


@pytest.mark.asyncio
class TestGetSubscribeSession:
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        mock_stripe_service: MagicMock,
    ) -> None:
        get_checkout_session_mock: MagicMock = mock_stripe_service.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            stripe_id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
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
        assert json["subscription_tier"]["id"] == str(subscription_tier_organization.id)
