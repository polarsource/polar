import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Customer, Order, Product, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest_asyncio.fixture
async def orders(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> list[Order]:
    return [await create_order(save_fixture, product=product, customer=customer)]


@pytest.mark.asyncio
class TestListOrders:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/orders/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, orders: list[Order]
    ) -> None:
        response = await client.get("/v1/orders/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.orders_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        response = await client.get("/v1/orders/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(orders)

    @pytest.mark.auth
    async def test_metadata_filter(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            user_metadata={"reference_id": "ABC"},
        )
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            user_metadata={"reference_id": "DEF"},
        )
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            user_metadata={"reference_id": "GHI"},
        )

        response = await client.get(
            "/v1/orders/", params={"metadata[reference_id]": ["ABC", "DEF"]}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 2


@pytest.mark.asyncio
class TestGetOrder:
    async def test_anonymous(self, client: AsyncClient, orders: list[Order]) -> None:
        response = await client.get(f"/v1/orders/{orders[0].id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/orders/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, orders: list[Order]
    ) -> None:
        response = await client.get(f"/v1/orders/{orders[0].id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.orders_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        response = await client.get(f"/v1/orders/{orders[0].id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(orders[0].id)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.orders_read}),
    )
    async def test_organization(self, client: AsyncClient, orders: list[Order]) -> None:
        response = await client.get(f"/v1/orders/{orders[0].id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(orders[0].id)

    @pytest.mark.auth
    async def test_custom_field(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            custom_field_data={"test": None},
        )

        response = await client.get(f"/v1/orders/{order.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["custom_field_data"] == {"test": None}


@pytest.mark.asyncio
class TestExportOrders:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/orders/export")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, orders: list[Order]
    ) -> None:
        response = await client.get("/v1/orders/export")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert (
            response.headers["content-disposition"]
            == "attachment; filename=polar-orders.csv"
        )

        # Should only have header row since user is not a member
        csv_lines = response.text.strip().split("\r\n")
        assert len(csv_lines) == 1
        assert (
            csv_lines[0]
            == "Email,Created At,Product,Amount,Currency,Status,Invoice number"
        )

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.orders_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        response = await client.get("/v1/orders/export")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert (
            response.headers["content-disposition"]
            == "attachment; filename=polar-orders.csv"
        )

        csv_lines = response.text.strip().split("\r\n")
        assert len(csv_lines) == len(orders) + 1  # +1 for header

        # Verify header
        assert (
            csv_lines[0]
            == "Email,Created At,Product,Amount,Currency,Status,Invoice number"
        )

        # Verify data row contains expected fields
        order = orders[0]
        data_row = csv_lines[1]
        assert order.product is not None
        assert order.customer.email in data_row
        assert order.description in data_row
        assert order.currency in data_row
        assert order.status.value in data_row

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.orders_read}),
    )
    async def test_organization(self, client: AsyncClient, orders: list[Order]) -> None:
        response = await client.get("/v1/orders/export")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"

        csv_lines = response.text.strip().split("\r\n")
        assert len(csv_lines) == len(orders) + 1

    @pytest.mark.auth
    async def test_filter_by_product(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        product_second: Product,
        customer: Customer,
    ) -> None:
        order1 = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        order2 = await create_order(
            save_fixture,
            product=product_second,
            customer=customer,
        )

        # Filter by product - should only get order1
        response = await client.get(
            "/v1/orders/export",
            params={"product_id": str(product.id)},
        )

        assert response.status_code == 200
        csv_lines = response.text.strip().split("\r\n")
        assert len(csv_lines) == 2  # Header + 1 order

        # Verify only the filtered order is in the export by checking invoice numbers
        assert order1.invoice_number in csv_lines[1]
        assert order2.invoice_number not in response.text


@pytest.mark.asyncio
class TesGetOrdersStatistics:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/orders/statistics")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.orders_read}),
    )
    async def test_user_valid(
        self, client: AsyncClient, user_organization: UserOrganization
    ) -> None:
        response = await client.get("/v1/orders/statistics")

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.orders_read}),
    )
    async def test_organization(self, client: AsyncClient) -> None:
        response = await client.get("/v1/orders/statistics")

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12
