import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import httpx_ws
import pytest

from polar.models import (
    Customer,
    CustomerMeter,
    Meter,
    Organization,
    ReducerBucket,
)
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
                {
                    "type": "customer_meter",
                    "customer_id": customer_meter.customer_id,
                    "meter_id": customer_meter.meter_id,
                },
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
    async def test_event_reducer_bucket(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        redis: Redis,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        bucket_start = datetime(2026, 10, 7, 12, 5, tzinfo=UTC)
        split_at = bucket_start + timedelta(minutes=2)
        bucket_end = bucket_start + timedelta(minutes=5)
        billed_at = datetime(2026, 10, 7, 12, 20, tzinfo=UTC)
        for start, end, generation, sealed_at, value in (
            (bucket_start, split_at, 1, billed_at, 3),
            (bucket_start, split_at, 2, billed_at, 4),
            (bucket_start, split_at, 3, None, 5),
            (split_at, bucket_end, 1, None, 6),
        ):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    external_customer_id="external",
                    bucket_start=start,
                    bucket_end=end,
                    count=1,
                    sum=Decimal(value),
                    min=Decimal(value),
                    max=Decimal(value),
                    generation=generation,
                    sealed_at=sealed_at,
                )
            )

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await publish(
                redis,
                organization.id,
                {
                    "type": "reducer_bucket",
                    "reducer_id": reducer.id,
                    "bucket_start": bucket_start.isoformat(),
                    "customer_id": None,
                    "external_customer_id": "external",
                },
            )

            response = await websocket.receive_json()

            assert response == {
                "type": "reducer_bucket",
                "payload": {
                    "reducer_id": str(reducer.id),
                    "customer_id": None,
                    "external_customer_id": "external",
                    "bucket_start": "2026-10-07T12:05:00Z",
                    "intervals": [
                        {
                            "bucket_start": "2026-10-07T12:05:00Z",
                            "bucket_end": "2026-10-07T12:07:00Z",
                            "sealed": True,
                            "count": 2,
                            "sum": 7.0,
                            "min": 3.0,
                            "max": 4.0,
                        },
                        {
                            "bucket_start": "2026-10-07T12:05:00Z",
                            "bucket_end": "2026-10-07T12:07:00Z",
                            "sealed": False,
                            "count": 1,
                            "sum": 5.0,
                            "min": 5.0,
                            "max": 5.0,
                        },
                        {
                            "bucket_start": "2026-10-07T12:07:00Z",
                            "bucket_end": "2026-10-07T12:10:00Z",
                            "sealed": False,
                            "count": 1,
                            "sum": 6.0,
                            "min": 6.0,
                            "max": 6.0,
                        },
                    ],
                },
            }

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_event_reducer_seal(
        self, client: httpx.AsyncClient, redis: Redis, organization: Organization
    ) -> None:
        reducer_id = uuid.uuid4()
        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await publish(
                redis,
                organization.id,
                {
                    "type": "reducer_seal",
                    "reducer_id": reducer_id,
                    "customer_id": None,
                    "external_customer_id": "external",
                    "sealed_until": "2026-10-07T12:07:00+00:00",
                },
            )

            response = await websocket.receive_json()

            assert response == {
                "type": "reducer_seal",
                "payload": {
                    "reducer_id": str(reducer_id),
                    "customer_id": None,
                    "external_customer_id": "external",
                    "sealed_until": "2026-10-07T12:07:00Z",
                },
            }
