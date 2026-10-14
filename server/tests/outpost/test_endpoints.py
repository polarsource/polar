from datetime import datetime, timedelta
from decimal import Decimal

import httpx
import httpx_ws
import pytest

from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    CustomerMeter,
    Meter,
    Organization,
    ReducerBucket,
)
from polar.outpost.service import SYNCED_LOOKBACK
from polar.outpost.stream import publish
from polar.redis import Redis
from polar.reducer.service import get_reducer_bucket_start
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
    async def test_request_meter_usage(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        customer_meter: CustomerMeter,
        customer_key: str,
    ) -> None:
        customer = customer_meter.customer
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[customer_meter.meter]
        )
        bucket_start = get_reducer_bucket_start(utc_now()) - timedelta(minutes=30)
        bucket_end = bucket_start + timedelta(minutes=5)
        await save_fixture(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                external_customer_id=customer.external_id,
                bucket_start=bucket_start,
                bucket_end=bucket_end,
                count=1,
                sum=Decimal(4),
                min=Decimal(4),
                max=Decimal(4),
                synced_at=bucket_end,
            )
        )
        customer_value = {
            "customer_id": str(customer.id),
            "external_customer_id": customer.external_id,
        }[customer_key]

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.send_json(
                {
                    "type": "meter_usage",
                    "payload": {
                        customer_key: customer_value,
                        "meter_id": str(customer_meter.meter_id),
                    },
                }
            )
            responses = [await websocket.receive_json() for _ in range(3)]

        payloads = {
            (payload["customer_id"], payload["external_customer_id"]): payload
            for payload in (response["payload"] for response in responses)
        }
        assert payloads.keys() == {
            (str(customer.id), None),
            (None, customer.external_id),
            (str(customer.id), customer.external_id),
        }
        assert all(p["credited_units"] == 100 for p in payloads.values())
        external = payloads[(None, customer.external_id)]
        assert datetime.fromisoformat(external["cold_until"]) == bucket_end
        assert (external["count"], external["sum"]) == (1, 4.0)
        internal = payloads[(str(customer.id), None)]
        version = datetime.fromisoformat(internal["version"])
        assert datetime.fromisoformat(internal["cold_until"]) == (
            get_reducer_bucket_start(version - SYNCED_LOOKBACK)
        )
        assert (internal["count"], internal["sum"]) == (0, 0.0)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_event_reducer_bucket(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        redis: Redis,
        organization: Organization,
        customer_meter: CustomerMeter,
    ) -> None:
        customer = customer_meter.customer
        external_id = customer.external_id
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[customer_meter.meter]
        )
        start = get_reducer_bucket_start(utc_now()) - timedelta(minutes=30)
        cold_until = start + timedelta(minutes=10)
        for (
            bucket_start,
            bucket_customer,
            external_customer_id,
            synced,
            sealed,
            value,
        ) in (
            (start, None, external_id, True, False, 3),
            (start + timedelta(minutes=5), None, external_id, True, False, 4),
            # Partial: a late event before its bucket got synced.
            (cold_until, None, external_id, False, False, 5),
            (start - timedelta(minutes=5), None, external_id, True, True, 6),
            # Another identity of the customer.
            (start, customer, None, True, False, 7),
        ):
            bucket_end = bucket_start + timedelta(minutes=5)
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer=bucket_customer,
                    external_customer_id=external_customer_id,
                    bucket_start=bucket_start,
                    bucket_end=bucket_end,
                    count=1,
                    sum=Decimal(value),
                    min=Decimal(value),
                    max=Decimal(value),
                    synced_at=bucket_end if synced else None,
                    sealed_at=bucket_end if sealed else None,
                )
            )

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await publish(
                redis,
                organization.id,
                {
                    "type": "reducer_bucket",
                    "reducer_id": reducer.id,
                    "customer_id": None,
                    "external_customer_id": external_id,
                },
            )

            response = await websocket.receive_json()

        payload = response["payload"]
        datetime.fromisoformat(payload.pop("version"))
        assert response == {
            "type": "meter_usage",
            "payload": {
                "meter_id": str(customer_meter.meter_id),
                "customer_id": None,
                "external_customer_id": external_id,
                "credited_units": 100,
                "cold_until": cold_until.isoformat().replace("+00:00", "Z"),
                "count": 2,
                "sum": 7.0,
                "min": 3.0,
                "max": 4.0,
            },
        }

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_event_reducer_bucket_synced_across_lookback(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        redis: Redis,
        organization: Organization,
        customer_meter: CustomerMeter,
    ) -> None:
        external_id = customer_meter.customer.external_id
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[customer_meter.meter]
        )
        # The bucket the lookback starts in.
        bucket_start = get_reducer_bucket_start(utc_now() - SYNCED_LOOKBACK)
        bucket_end = bucket_start + timedelta(minutes=5)
        await save_fixture(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                external_customer_id=external_id,
                bucket_start=bucket_start,
                bucket_end=bucket_end,
                count=1,
                sum=Decimal(3),
                min=Decimal(3),
                max=Decimal(3),
                synced_at=bucket_end,
            )
        )

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await publish(
                redis,
                organization.id,
                {
                    "type": "reducer_bucket",
                    "reducer_id": reducer.id,
                    "customer_id": None,
                    "external_customer_id": external_id,
                },
            )

            response = await websocket.receive_json()

        payload = response["payload"]
        assert datetime.fromisoformat(payload["cold_until"]) == bucket_end
        assert payload["count"] == 1
