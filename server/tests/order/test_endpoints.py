import uuid
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import AsyncClient
from pytest_mock import MockerFixture

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


@pytest_asyncio.fixture
async def order_organization_second(
    save_fixture: SaveFixture,
    product_organization_second: Product,
    customer_organization_second: Customer,
) -> Order:
    return await create_order(
        save_fixture,
        product=product_organization_second,
        customer=customer_organization_second,
    )


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
        assert "receipt_number" in json
        assert json["receipt_number"] is None

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
        assert order.customer.email is not None
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


@pytest.mark.asyncio
class TestUpdateOrder:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/orders/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_order(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        order_organization_second: Order,
    ) -> None:
        response = await client.patch(
            f"/v1/orders/{order_organization_second.id}",
            json={},
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestGenerateOrderInvoice:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(f"/v1/orders/{uuid.uuid4()}/invoice")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_order(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        order_organization_second: Order,
    ) -> None:
        response = await client.post(
            f"/v1/orders/{order_organization_second.id}/invoice"
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestGetOrderInvoice:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/orders/{uuid.uuid4()}/invoice")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_order(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        order_organization_second: Order,
    ) -> None:
        response = await client.get(
            f"/v1/orders/{order_organization_second.id}/invoice"
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestGetOrderReceipt:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/orders/{uuid.uuid4()}/receipt")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_order(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        order_organization_second: Order,
    ) -> None:
        response = await client.get(
            f"/v1/orders/{order_organization_second.id}/receipt"
        )

        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.orders_read}))
    async def test_404_when_no_receipt_number(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        order = orders[0]
        response = await client.get(f"/v1/orders/{order.id}/receipt")

        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.orders_read}))
    async def test_202_when_pending_render(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        order = orders[0]
        order.receipt_number = "RCPT-FOO-0001"
        await save_fixture(order)

        enqueue_mock = mocker.patch("polar.receipt.service.enqueue_job")

        response = await client.get(f"/v1/orders/{order.id}/receipt")

        assert response.status_code == 202
        enqueue_mock.assert_called_once_with("receipt.render", order_id=order.id)

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.orders_read}))
    async def test_200_when_receipt_ready(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        order = orders[0]
        order.receipt_number = "RCPT-FOO-0001"
        order.receipt_path = f"{order.organization_id}/{order.id}/receipt.pdf"
        await save_fixture(order)

        s3_mock = mocker.patch("polar.receipt.service.S3Service")
        s3_mock.return_value.generate_presigned_download_url.return_value = (
            "https://example.com/signed-url",
            datetime(2030, 1, 1, tzinfo=UTC),
        )

        response = await client.get(f"/v1/orders/{order.id}/receipt")

        assert response.status_code == 200
        assert response.json() == {"url": "https://example.com/signed-url"}
