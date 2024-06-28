import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Order, Product, User, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest_asyncio.fixture
async def orders(
    save_fixture: SaveFixture, product: Product, user_second: User
) -> list[Order]:
    return [await create_order(save_fixture, product=product, user=user_second)]


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
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
        user_organization_admin: UserOrganization,
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
@pytest.mark.http_auto_expunge
class TesGetOrdersStatistics:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/orders/statistics")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.orders_read}),
    )
    async def test_user_valid(
        self, client: AsyncClient, user_organization_admin: UserOrganization
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
