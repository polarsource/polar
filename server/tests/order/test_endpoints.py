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
        AuthSubjectFixture(scopes={Scope.web_default}),
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

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.orders_read}),
    )
    async def test_organization(self, client: AsyncClient, orders: list[Order]) -> None:
        response = await client.get("/v1/orders/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(orders)


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
        AuthSubjectFixture(scopes={Scope.web_default}),
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
class TesGetOrdersStatistics:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/orders/statistics")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
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
