import uuid

import pytest
from httpx import AsyncClient

from polar.models import (
    Organization,
    Repository,
    SubscriptionGroup,
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


@pytest.mark.asyncio
class TestCreateSubscriptionGroup:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/subscriptions/groups/",
            json={
                "name": "Subscription Group",
                "order": 1,
                "organization_id": str(uuid.uuid4()),
            },
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_neither_organization_or_repository(
        self, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/groups/",
            json={"name": "Subscription Group", "order": 1},
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
            "/api/v1/subscriptions/groups/",
            json={
                "name": "Subscription Group",
                "order": 1,
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
            "/api/v1/subscriptions/groups/",
            json={
                "name": "Subscription Group",
                "order": 1,
                "organization_id": str(organization.id),
            },
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
