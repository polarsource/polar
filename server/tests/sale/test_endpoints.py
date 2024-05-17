import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Product, Sale, User, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_sale


@pytest_asyncio.fixture
async def sales(
    save_fixture: SaveFixture, product: Product, user_second: User
) -> list[Sale]:
    return [await create_sale(save_fixture, product=product, user=user_second)]


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestListSales:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/sales/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, sales: list[Sale]
    ) -> None:
        response = await client.get("/api/v1/sales/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_sales_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization_admin: UserOrganization,
        sales: list[Sale],
    ) -> None:
        response = await client.get("/api/v1/sales/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(sales)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.creator_sales_read}),
    )
    async def test_organization(self, client: AsyncClient, sales: list[Sale]) -> None:
        response = await client.get("/api/v1/sales/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(sales)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TesGetSalesStatistics:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/sales/statistics")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_sales_read}),
    )
    async def test_user_valid(
        self, client: AsyncClient, user_organization_admin: UserOrganization
    ) -> None:
        response = await client.get("/api/v1/sales/statistics")

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.creator_sales_read}),
    )
    async def test_organization(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/sales/statistics")

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12
