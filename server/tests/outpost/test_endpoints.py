from decimal import Decimal

import httpx
import httpx_ws
import pytest

from polar.models import Customer, CustomerMeter, Meter, Organization
from polar.outpost.stream import publish
from polar.redis import Redis
from tests.fixtures import AuthSubjectFixture, SaveFixture
from tests.fixtures.random_objects import create_reducer


@pytest.fixture
async def customer_meter(
    save_fixture: SaveFixture, customer_external_id: Customer, meter: Meter
) -> CustomerMeter:
    customer_meter = CustomerMeter(
        customer=customer_external_id,
        meter=meter,
        consumed_units=Decimal(90),
        credited_units=100,
        balance=Decimal(10),
        last_balanced_event=None,
    )
    await save_fixture(customer_meter)
    return customer_meter


@pytest.mark.anyio
@pytest.mark.websocket
class TestOutpost:
    async def test_anonymous(self, client: httpx.AsyncClient, meter: Meter) -> None:
        with pytest.raises(httpx_ws.WebSocketUpgradeError) as exc:
            async with httpx_ws.aconnect_ws("/v1/outpost/", client=client):
                pass
        assert exc.value.response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_request_configuration(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.send_json({"type": "configuration"})
            response = await websocket.receive_json()

            assert response["type"] == "configuration"
            [reducer_payload] = response["payload"]["reducers"]
            assert reducer_payload["id"] == str(reducer.id)
            assert reducer_payload["meter_ids"] == [str(meter.id)]
            assert reducer_payload["filter"] == meter.filter.model_dump(mode="json")
            assert reducer_payload["aggregation"] == meter.aggregation.model_dump(
                mode="json"
            )

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.parametrize("customer_key", ["customer_id", "external_customer_id"])
    async def test_request_customer_meter(
        self,
        client: httpx.AsyncClient,
        customer_meter: CustomerMeter,
        customer_key: str,
    ) -> None:
        customer_value = {
            "customer_id": str(customer_meter.customer_id),
            "external_customer_id": customer_meter.customer.external_id,
        }[customer_key]
        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.send_json(
                {
                    "type": "customer_meter",
                    "payload": {
                        customer_key: customer_value,
                        "meter_id": str(customer_meter.meter_id),
                    },
                }
            )
            response = await websocket.receive_json()

            assert response["type"] == "customer_meter"
            assert response["payload"]["customer_id"] == str(customer_meter.customer_id)
            assert (
                response["payload"]["external_customer_id"]
                == customer_meter.customer.external_id
            )
            assert response["payload"]["meter_id"] == str(customer_meter.meter_id)
            assert response["payload"]["consumed_units"] == 90.0
            assert response["payload"]["credited_units"] == 100
            assert response["payload"]["balance"] == 10.0

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_event_customer_meter(
        self, client: httpx.AsyncClient, redis: Redis, customer_meter: CustomerMeter
    ) -> None:
        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await publish(
                redis,
                customer_meter.customer.organization_id,
                type="customer_meter",
                customer_id=customer_meter.customer_id,
                meter_id=customer_meter.meter_id,
            )

            response = await websocket.receive_json()

            assert response["type"] == "customer_meter"
            assert response["payload"]["customer_id"] == str(customer_meter.customer_id)
            assert (
                response["payload"]["external_customer_id"]
                == customer_meter.customer.external_id
            )
            assert response["payload"]["meter_id"] == str(customer_meter.meter_id)
            assert response["payload"]["consumed_units"] == 90.0
            assert response["payload"]["credited_units"] == 100
            assert response["payload"]["balance"] == 10.0
