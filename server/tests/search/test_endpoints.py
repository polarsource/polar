import uuid

import pytest
from httpx import AsyncClient

from polar.enums import SubscriptionRecurringInterval
from polar.models import (
    Organization,
    UserOrganization,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_product,
)


@pytest.mark.asyncio
class TestSearch:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/search",
            params={
                "organization_id": str(uuid.uuid4()),
                "query": "test",
            },
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.get(
            "/search",
            params={
                "organization_id": str(organization.id),
                "query": "test",
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert json["results"] == []

    @pytest.mark.auth
    async def test_search_products_by_name(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Premium Plan",
            recurring_interval=SubscriptionRecurringInterval.month,
        )

        response = await client.get(
            "/search",
            params={
                "organization_id": str(organization.id),
                "query": "Premium",
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert len(json["results"]) >= 1
        assert any(
            r["type"] == "product" and r["name"] == "Premium Plan"
            for r in json["results"]
        )

    @pytest.mark.auth
    async def test_search_products_by_description(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Basic Plan",
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        product.description = "Includes free support"
        await save_fixture(product)

        response = await client.get(
            "/search",
            params={
                "organization_id": str(organization.id),
                "query": "free",
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert len(json["results"]) >= 1
        assert any(
            r["type"] == "product" and r["name"] == "Basic Plan"
            for r in json["results"]
        )

    @pytest.mark.auth
    async def test_search_customers_by_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="test@example.com",
        )

        response = await client.get(
            "/search",
            params={
                "organization_id": str(organization.id),
                "query": "test@example",
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert len(json["results"]) >= 1
        assert any(
            r["type"] == "customer" and r["email"] == "test@example.com"
            for r in json["results"]
        )

    @pytest.mark.auth
    async def test_search_partial_match(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Parrot Free",
            recurring_interval=SubscriptionRecurringInterval.month,
        )

        response = await client.get(
            "/search",
            params={
                "organization_id": str(organization.id),
                "query": "Free",
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert len(json["results"]) >= 1
        assert any(
            r["type"] == "product" and r["name"] == "Parrot Free"
            for r in json["results"]
        )
