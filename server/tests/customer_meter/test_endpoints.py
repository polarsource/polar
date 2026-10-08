import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient

from polar.models import (
    Customer,
    CustomerMeter,
    Organization,
    UserOrganization,
)
from polar.version import V2027_01
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_meter


@pytest.fixture
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


@pytest.fixture
async def customer_meters_with_external_ids(
    save_fixture: SaveFixture, organization: Organization, customer: Customer
) -> tuple[CustomerMeter, CustomerMeter]:
    customer_meters: list[CustomerMeter] = []
    for external_id in ("tool_call", "tokens"):
        meter = await create_meter(
            save_fixture,
            id=uuid.uuid4(),
            organization=organization,
            external_id=external_id,
        )
        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            consumed_units=Decimal(0),
            credited_units=0,
            balance=Decimal(0),
        )
        await save_fixture(customer_meter)
        customer_meters.append(customer_meter)
    return customer_meters[0], customer_meters[1]


@pytest.mark.anyio
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

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_external_meter_id_2027_01(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer_meters_with_external_ids: tuple[CustomerMeter, CustomerMeter],
    ) -> None:
        tool_call, _ = customer_meters_with_external_ids

        response = await client.get(
            "/v1/customer-meters/", params={"external_meter_id": "tool_call"}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(tool_call.id)


@pytest.mark.anyio
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
