from decimal import Decimal

import httpx
import httpx_ws
import pytest
import pytest_asyncio

from polar.models import Customer, CustomerMeter, Meter
from tests.fixtures import AuthSubjectFixture, SaveFixture


@pytest_asyncio.fixture
async def customer_meter(
    save_fixture: SaveFixture, customer: Customer, meter: Meter
) -> CustomerMeter:
    customer_meter = CustomerMeter(
        customer=customer,
        meter=meter,
        consumed_units=Decimal(90),
        credited_units=100,
        balance=Decimal(10),
    )
    await save_fixture(customer_meter)
    return customer_meter


@pytest.mark.anyio
class TestOutpost:
    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_request_configuration(
        self, client: httpx.AsyncClient, meter: Meter
    ) -> None:
        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.send_json({"type": "configuration"})
            response = await websocket.receive_json()

            assert response["type"] == "configuration"
            assert response["payload"]["meters"][0]["id"] == str(meter.id)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_request_customer_meter(
        self, client: httpx.AsyncClient, customer_meter: CustomerMeter
    ) -> None:
        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.send_json(
                {
                    "type": "customer_meter",
                    "payload": {
                        "customer_id": str(customer_meter.customer_id),
                        "meter_id": str(customer_meter.meter_id),
                    },
                }
            )
            response = await websocket.receive_json()

            assert response["type"] == "customer_meter"
            assert response["payload"]["customer_id"] == str(customer_meter.customer_id)
            assert response["payload"]["meter_id"] == str(customer_meter.meter_id)
            assert response["payload"]["consumed_units"] == 90.0
            assert response["payload"]["credited_units"] == 100
            assert response["payload"]["balance"] == 10.0
