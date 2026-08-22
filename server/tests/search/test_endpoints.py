import uuid

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.enums import SubscriptionRecurringInterval
from polar.models import (
    Organization,
    UserOrganization,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
    create_product,
    create_subscription,
)


@pytest.mark.asyncio
class TestSearch:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/search",
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
            "/v1/search",
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
            "/v1/search",
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
            "/v1/search",
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
            "/v1/search",
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
            "/v1/search",
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

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.products_read}))
    async def test_search_with_only_products_scope(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Test Product",
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="test@example.com",
        )

        response = await client.get(
            "/v1/search",
            params={
                "organization_id": str(organization.id),
                "query": "Test",
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert len(json["results"]) == 1
        assert all(r["type"] == "product" for r in json["results"])
        assert json["results"][0]["name"] == "Test Product"

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.customers_read}))
    async def test_search_with_only_customers_scope(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Test Product",
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="testuser@example.com",
        )

        response = await client.get(
            "/v1/search",
            params={
                "organization_id": str(organization.id),
                "query": "test",
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert len(json["results"]) == 1
        assert all(r["type"] == "customer" for r in json["results"])
        assert json["results"][0]["email"] == "testuser@example.com"

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.products_read, Scope.customers_read})
    )
    async def test_search_with_multiple_scopes(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Search Product",
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="search@example.com",
        )

        response = await client.get(
            "/v1/search",
            params={
                "organization_id": str(organization.id),
                "query": "search",
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert len(json["results"]) == 2
        result_types = {r["type"] for r in json["results"]}
        assert "product" in result_types
        assert "customer" in result_types

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_search_with_no_scopes(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Test Product",
            recurring_interval=SubscriptionRecurringInterval.month,
        )

        response = await client.get(
            "/v1/search",
            params={
                "organization_id": str(organization.id),
                "query": "Test",
            },
        )
        assert response.status_code == 403

    @pytest.mark.auth
    @pytest.mark.parametrize(
        ("query", "match_email", "non_match_email"),
        [
            # `_` is a SQL LIKE wildcard for any single character; `user_one`
            # must not also match `userAone`.
            ("user_one", "user_one@example.com", "userAone@example.com"),
            # `%` is a SQL LIKE wildcard for any string; `user%one` must not
            # match `userXone` (the inner `%` would match the `X`).
            ("user%one", "user_one@example.com", "userXone@example.com"),
        ],
    )
    async def test_search_escapes_like_wildcards_in_customer_email(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        query: str,
        match_email: str,
        non_match_email: str,
    ) -> None:
        await create_customer(
            save_fixture, organization=organization, email=match_email
        )
        await create_customer(
            save_fixture, organization=organization, email=non_match_email
        )

        response = await client.get(
            "/v1/search",
            params={
                "organization_id": str(organization.id),
                "query": query,
            },
        )
        assert response.status_code == 200
        emails = {
            r.get("email") or r.get("customer_email")
            for r in response.json()["results"]
        }
        emails.discard(None)
        assert match_email in emails
        assert non_match_email not in emails

    @pytest.mark.auth
    async def test_search_escapes_like_wildcards_for_orders_and_subscriptions(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # `_` is a LIKE wildcard for any single character; matching the
        # customer email on orders and subscriptions must treat it literally,
        # so a search for `user_one` must not surface `userAone`'s records.
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Alpha Plan",
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        match = await create_customer(
            save_fixture, organization=organization, email="user_one@example.com"
        )
        non_match = await create_customer(
            save_fixture, organization=organization, email="userAone@example.com"
        )
        await create_order(save_fixture, product=product, customer=match)
        await create_order(save_fixture, product=product, customer=non_match)
        await create_subscription(save_fixture, product=product, customer=match)
        await create_subscription(save_fixture, product=product, customer=non_match)

        response = await client.get(
            "/v1/search",
            params={
                "organization_id": str(organization.id),
                "query": "user_one",
            },
        )
        assert response.status_code == 200
        emails = {
            r.get("email") or r.get("customer_email")
            for r in response.json()["results"]
        }
        emails.discard(None)
        assert "user_one@example.com" in emails
        assert "userAone@example.com" not in emails
