import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import Customer, Dispute, Product, UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_dispute,
    create_order,
    create_payment,
)


@pytest_asyncio.fixture
async def dispute_organization_second(
    save_fixture: SaveFixture,
    product_organization_second: Product,
    customer_organization_second: Customer,
) -> Dispute:
    order = await create_order(
        save_fixture,
        product=product_organization_second,
        customer=customer_organization_second,
    )
    payment = await create_payment(
        save_fixture,
        customer_organization_second.organization,
        order=order,
    )
    return await create_dispute(save_fixture, order, payment)


@pytest.mark.asyncio
class TestListDisputes:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/disputes/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_disputes(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        dispute_organization_second: Dispute,
    ) -> None:
        response = await client.get("/v1/disputes/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0


@pytest.mark.asyncio
class TestGetDispute:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/disputes/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_dispute(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        dispute_organization_second: Dispute,
    ) -> None:
        response = await client.get(f"/v1/disputes/{dispute_organization_second.id}")

        assert response.status_code == 404
