import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import Customer, Dispute, Organization, Product, UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_dispute,
    create_dispute_case,
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

    @pytest.mark.auth
    async def test_case_id_present_when_case_exists(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)

        response = await client.get(f"/v1/disputes/{case.dispute_id}")

        assert response.status_code == 200
        assert response.json()["case_id"] == str(case.id)

    @pytest.mark.auth
    async def test_case_id_null_without_case(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer, product=product)
        payment = await create_payment(save_fixture, organization, order=order)
        dispute = await create_dispute(save_fixture, order, payment)

        response = await client.get(f"/v1/disputes/{dispute.id}")

        assert response.status_code == 200
        assert response.json()["case_id"] is None
