import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import Organization, Payment, UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payment


@pytest_asyncio.fixture
async def payment_organization_second(
    save_fixture: SaveFixture, organization_second: Organization
) -> Payment:
    return await create_payment(save_fixture, organization_second)


@pytest.mark.asyncio
class TestListPayments:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/payments/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_payments(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payment_organization_second: Payment,
    ) -> None:
        response = await client.get("/v1/payments/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0


@pytest.mark.asyncio
class TestGetPayment:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/payments/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_payment(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payment_organization_second: Payment,
    ) -> None:
        response = await client.get(f"/v1/payments/{payment_organization_second.id}")

        assert response.status_code == 404
