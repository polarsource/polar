import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import (
    Customer,
    CustomerMeter,
    Organization,
    UserOrganization,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_meter


@pytest_asyncio.fixture
async def customer_meter_organization_second(
    save_fixture: SaveFixture,
    organization_second: Organization,
    customer_organization_second: Customer,
) -> CustomerMeter:
    meter = await create_meter(
        save_fixture,
        id=uuid.uuid4(),
        organization=organization_second,
    )
    customer_meter = CustomerMeter(
        customer=customer_organization_second,
        meter=meter,
        consumed_units=Decimal(0),
        credited_units=0,
        balance=Decimal(0),
    )
    await save_fixture(customer_meter)
    return customer_meter


@pytest.mark.asyncio
class TestListCustomerMeters:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/customer-meters/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_customer_meters(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer_meter_organization_second: CustomerMeter,
    ) -> None:
        response = await client.get("/v1/customer-meters/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0


@pytest.mark.asyncio
class TestGetCustomerMeter:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/customer-meters/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_customer_meter(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer_meter_organization_second: CustomerMeter,
    ) -> None:
        response = await client.get(
            f"/v1/customer-meters/{customer_meter_organization_second.id}"
        )

        assert response.status_code == 404
