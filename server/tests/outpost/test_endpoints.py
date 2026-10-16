import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import httpx_ws
import pytest
from logfire.experimental.forwarding import ForwardExportRequestResponse
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.common.v1.common_pb2 import AnyValue
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    CustomerMeter,
    Meter,
    Organization,
    ReducerBucket,
)
from polar.outpost.schemas import to_epoch_microseconds
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
    async def test_connection(self, client: httpx.AsyncClient) -> None:
        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            message = await websocket.receive_json()

            assert message["type"] == "connection"
            assert uuid.UUID(message["payload"]["id"])

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
            await websocket.receive_json()
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
            await websocket.receive_json()
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
        assert all(p["customer_exists"] for p in payloads.values())
        external = payloads[(None, customer.external_id)]
        assert external["cold_until"] == to_epoch_microseconds(bucket_end)
        assert (external["count"], external["sum"]) == (1, 4.0)
        internal = payloads[(str(customer.id), None)]
        version = datetime.fromtimestamp(internal["version"] / 1_000_000, UTC)
        assert internal["cold_until"] == to_epoch_microseconds(
            get_reducer_bucket_start(version - SYNCED_LOOKBACK)
        )
        assert (internal["count"], internal["sum"]) == (0, 0.0)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_request_meter_usage_unknown_customer(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        await create_reducer(save_fixture, organization=organization, meters=[meter])

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.receive_json()
            await websocket.send_json(
                {
                    "type": "meter_usage",
                    "payload": {
                        "external_customer_id": "unknown",
                        "meter_id": str(meter.id),
                    },
                }
            )
            response = await websocket.receive_json()

        assert response["payload"]["external_customer_id"] == "unknown"
        assert response["payload"]["customer_exists"] is False

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
            await websocket.receive_json()
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
        assert isinstance(payload.pop("version"), int)
        assert response == {
            "type": "meter_usage",
            "payload": {
                "meter_id": str(customer_meter.meter_id),
                "customer_id": None,
                "external_customer_id": external_id,
                "customer_exists": True,
                "credited_units": 100,
                "cold_until": to_epoch_microseconds(cold_until),
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
            await websocket.receive_json()
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
        assert payload["cold_until"] == to_epoch_microseconds(bucket_end)
        assert payload["count"] == 1


def _export_request(**attributes: str) -> ExportTraceServiceRequest:
    request = ExportTraceServiceRequest()
    resource_spans = request.resource_spans.add()
    for key, value in attributes.items():
        resource_spans.resource.attributes.add(
            key=key, value=AnyValue(string_value=value)
        )
    return request


@pytest.mark.anyio
class TestTelemetry:
    async def test_anonymous(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/v1/outpost/telemetry",
            content=_export_request().SerializeToString(),
            headers={"Content-Type": "application/x-protobuf"},
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_invalid_body(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/v1/outpost/telemetry",
            content=b"not protobuf",
            headers={"Content-Type": "application/x-protobuf"},
        )

        assert response.status_code == 400

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_forwards_with_organization(
        self,
        mocker: MockerFixture,
        client: httpx.AsyncClient,
        organization: Organization,
    ) -> None:
        forward_mock = mocker.patch(
            "polar.outpost.service.logfire.forward_export_request",
            return_value=ForwardExportRequestResponse(
                status_code=200,
                headers={"Content-Type": "application/x-protobuf"},
                content=b"",
            ),
        )

        response = await client.post(
            "/v1/outpost/telemetry",
            content=_export_request(
                **{"polar.organization_id": "spoofed", "service.name": "other"}
            ).SerializeToString(),
            headers={"Content-Type": "application/x-protobuf"},
        )

        assert response.status_code == 200
        forwarded = ExportTraceServiceRequest()
        forwarded.ParseFromString(forward_mock.call_args.kwargs["body"])
        attributes = {
            attribute.key: attribute.value.string_value
            for attribute in forwarded.resource_spans[0].resource.attributes
        }
        assert attributes == {
            "polar.organization_id": str(organization.id),
            "service.name": "outpost",
            "deployment.environment.name": "testing",
        }
        assert forward_mock.call_args.kwargs["path"] == "/v1/traces"
