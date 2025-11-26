from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from polar.models import Customer, Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_event, create_order


@pytest.mark.asyncio
class TestListAnalytics:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/customers/analytics",
            params={
                "organization_id": "00000000-0000-0000-0000-000000000000",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
            },
        )
        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        response = await client.get(
            "/v1/customers/analytics",
            params={
                "organization_id": str(organization.id),
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
            },
        )
        assert response.status_code == 403

    @pytest.mark.auth
    async def test_empty_results(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
    ) -> None:
        response = await client.get(
            "/v1/customers/analytics",
            params={
                "organization_id": str(organization.id),
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["customer_id"] == str(customer.id)
        assert json["items"][0]["lifetime_revenue"] == 0
        assert json["items"][0]["lifetime_cost"] == 0

    @pytest.mark.auth
    async def test_customer_with_revenue_and_cost(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
    ) -> None:
        now = datetime.now(UTC)
        await create_order(
            save_fixture,
            customer=customer,
            subtotal_amount=10000,
            created_at=now,
        )

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="test.event",
            metadata={"_cost": {"amount": 3000}},
            timestamp=now,
        )

        response = await client.get(
            "/v1/customers/analytics",
            params={
                "organization_id": str(organization.id),
                "start_date": now.strftime("%Y-%m-%d"),
                "end_date": now.strftime("%Y-%m-%d"),
                "interval": "day",
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1

        item = json["items"][0]
        assert item["customer_id"] == str(customer.id)
        assert item["lifetime_revenue"] == 10000
        assert item["lifetime_cost"] == 3000
        assert item["profit"] == 7000
        assert float(item["margin_percent"]) == 70.0

    @pytest.mark.auth
    async def test_customer_with_zero_revenue(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
    ) -> None:
        now = datetime.now(UTC)
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="test.event",
            metadata={"_cost": {"amount": 5000}},
            timestamp=now,
        )

        response = await client.get(
            "/v1/customers/analytics",
            params={
                "organization_id": str(organization.id),
                "start_date": now.strftime("%Y-%m-%d"),
                "end_date": now.strftime("%Y-%m-%d"),
                "interval": "day",
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1

        item = json["items"][0]
        assert item["lifetime_revenue"] == 0
        assert item["lifetime_cost"] == 5000
        assert item["profit"] == -5000
        assert float(item["margin_percent"]) == 0

    @pytest.mark.auth
    async def test_sorting_by_profit(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        now = datetime.now(UTC)
        await create_order(
            save_fixture,
            customer=customer,
            subtotal_amount=20000,
            created_at=now,
        )
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="test.event",
            metadata={"_cost": {"amount": 1000}},
            timestamp=now,
        )

        await create_order(
            save_fixture,
            customer=customer_second,
            subtotal_amount=5000,
            created_at=now,
            stripe_invoice_id="INVOICE_ID_2",
        )
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer_second,
            name="test.event",
            metadata={"_cost": {"amount": 4000}},
            timestamp=now,
        )

        response = await client.get(
            "/v1/customers/analytics",
            params={
                "organization_id": str(organization.id),
                "start_date": now.strftime("%Y-%m-%d"),
                "end_date": now.strftime("%Y-%m-%d"),
                "interval": "day",
                "sorting": ["-profit"],
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 2

        assert json["items"][0]["customer_id"] == str(customer.id)
        assert json["items"][0]["profit"] == 19000

        assert json["items"][1]["customer_id"] == str(customer_second.id)
        assert json["items"][1]["profit"] == 1000

    @pytest.mark.auth
    async def test_pagination(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
    ) -> None:
        now = datetime.now(UTC)
        for i in range(4):
            c = await create_customer(
                save_fixture,
                organization=organization,
                email=f"customer{i}@example.com",
            )
            await create_order(
                save_fixture,
                customer=c,
                subtotal_amount=(i + 2) * 1000,
                created_at=now,
                stripe_invoice_id=f"INVOICE_ID_{i}",
            )
        await create_order(
            save_fixture,
            customer=customer,
            subtotal_amount=1000,
            created_at=now,
            stripe_invoice_id="INVOICE_ID_FIXTURE",
        )

        response = await client.get(
            "/v1/customers/analytics",
            params={
                "organization_id": str(organization.id),
                "start_date": now.strftime("%Y-%m-%d"),
                "end_date": now.strftime("%Y-%m-%d"),
                "interval": "day",
                "limit": 2,
                "page": 1,
                "sorting": ["-lifetime_revenue"],
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 5
        assert len(json["items"]) == 2
        assert json["items"][0]["lifetime_revenue"] == 5000
        assert json["items"][1]["lifetime_revenue"] == 4000

        response = await client.get(
            "/v1/customers/analytics",
            params={
                "organization_id": str(organization.id),
                "start_date": now.strftime("%Y-%m-%d"),
                "end_date": now.strftime("%Y-%m-%d"),
                "interval": "day",
                "limit": 2,
                "page": 2,
                "sorting": ["-lifetime_revenue"],
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 2
        assert json["items"][0]["lifetime_revenue"] == 3000
        assert json["items"][1]["lifetime_revenue"] == 2000

    @pytest.mark.auth
    async def test_include_periods(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
    ) -> None:
        now = datetime.now(UTC)
        await create_order(
            save_fixture,
            customer=customer,
            subtotal_amount=10000,
            created_at=now,
        )

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="test.event",
            metadata={"_cost": {"amount": 3000}},
            timestamp=now,
        )

        response = await client.get(
            "/v1/customers/analytics",
            params={
                "organization_id": str(organization.id),
                "start_date": now.strftime("%Y-%m-%d"),
                "end_date": now.strftime("%Y-%m-%d"),
                "interval": "day",
                "include_periods": "true",
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1

        item = json["items"][0]
        assert item["customer_id"] == str(customer.id)
        assert len(item["periods"]) == 1

        period = item["periods"][0]
        assert float(period["revenue"]) == 10000
        assert float(period["cost"]) == 3000
        assert float(period["profit"]) == 7000
