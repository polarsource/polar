import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import httpx_ws
import pytest
from logfire.experimental.forwarding import ForwardExportRequestResponse
from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import (
    ExportMetricsServiceRequest,
)
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
    StagedEvent,
)
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.outpost.schemas import to_epoch_microseconds
from polar.outpost.service import SYNCED_LOOKBACK
from polar.outpost.stream import publish
from polar.redis import Redis
from polar.reducer.service import get_reducer_bucket_start
from tests.fixtures import AuthSubjectFixture, SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_event,
    create_reducer,
)


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
        reducers = {
            kind: await create_reducer(
                save_fixture, organization=organization, meters=[meter], kind=kind
            )
            for kind in ReducerKind
        }

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.receive_json()
            await websocket.send_json({"type": "configuration"})
            response = await websocket.receive_json()

            assert response["type"] == "configuration"
            payloads = response["payload"]["reducers"]
            assert {payload["kind"]: payload["id"] for payload in payloads} == {
                kind: str(reducer.id) for kind, reducer in reducers.items()
            }
            for reducer_payload in payloads:
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
    async def test_event_reducer_bucket_split_half_synced(
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
        start = get_reducer_bucket_start(utc_now()) - timedelta(minutes=30)
        split_at = start + timedelta(minutes=7)
        # A seal split the second slot and only its first part is synced: the cold usage
        # stops at the slot's start, since clients count whole slots.
        for bucket_start, bucket_end, synced, value in (
            (start, start + timedelta(minutes=5), True, 3),
            (start + timedelta(minutes=5), split_at, True, 4),
            (split_at, start + timedelta(minutes=10), False, 5),
        ):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    external_customer_id=external_id,
                    bucket_start=bucket_start,
                    bucket_end=bucket_end,
                    count=1,
                    sum=Decimal(value),
                    min=Decimal(value),
                    max=Decimal(value),
                    synced_at=bucket_end if synced else None,
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
        assert payload["cold_until"] == to_epoch_microseconds(
            start + timedelta(minutes=5)
        )
        assert payload["count"] == 1
        assert payload["sum"] == 3.0

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

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_confirm_pending(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        bucket_start = get_reducer_bucket_start(utc_now()) - timedelta(minutes=30)
        synced_at = bucket_start + timedelta(minutes=5)
        await save_fixture(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                external_customer_id="alice",
                bucket_start=bucket_start,
                bucket_end=synced_at,
                count=2,
                sum=Decimal(2),
                min=Decimal(1),
                max=Decimal(1),
                synced_at=synced_at,
            )
        )
        # The answer carries the ids stored, staged ones included, and the snapshot read in
        # the same transaction: what the snapshot counts and the ids agree.
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=bucket_start + timedelta(seconds=1),
            external_customer_id="alice",
            external_id="counted",
        )
        await save_fixture(
            StagedEvent(
                organization_id=organization.id,
                name=METER_TEST_EVENT,
                source=EventSource.user,
                timestamp=bucket_start + timedelta(seconds=2),
                ingested_at=utc_now(),
                external_customer_id="alice",
                external_id="staged",
                user_metadata={},
            )
        )

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.receive_json()
            await websocket.send_json(
                {
                    "type": "confirm",
                    "payload": {
                        "reducer_id": str(reducer.id),
                        "external_customer_id": "alice",
                        "bucket_start": to_epoch_microseconds(bucket_start),
                        "meter_id": str(meter.id),
                        "ids": ["counted", "unknown", "staged"],
                    },
                }
            )
            response = await websocket.receive_json(timeout=2)

        assert isinstance(response["payload"]["snapshot"].pop("version"), int)
        assert response == {
            "type": "confirmed",
            "payload": {
                "reducer_id": str(reducer.id),
                "customer_id": None,
                "external_customer_id": "alice",
                "bucket_start": to_epoch_microseconds(bucket_start),
                "ids": ["counted", "staged"],
                "snapshot": {
                    "meter_id": str(meter.id),
                    "customer_id": None,
                    "external_customer_id": "alice",
                    "customer_exists": False,
                    "credited_units": 0,
                    "cold_until": to_epoch_microseconds(synced_at),
                    "count": 2,
                    "sum": 2.0,
                    "min": 1.0,
                    "max": 1.0,
                },
            },
        }

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_confirm_pending_split_bucket(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        bucket_start = get_reducer_bucket_start(utc_now()) - timedelta(minutes=30)
        # A seal split the bucket: only its first half is synced, so the snapshot's
        # cold usage stops there and only the events before the split count.
        split_at = bucket_start + timedelta(minutes=2)
        for interval_start, interval_end, synced_at in (
            (bucket_start, split_at, split_at),
            (split_at, bucket_start + timedelta(minutes=5), None),
        ):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    external_customer_id="alice",
                    bucket_start=interval_start,
                    bucket_end=interval_end,
                    count=1,
                    sum=Decimal(1),
                    min=Decimal(1),
                    max=Decimal(1),
                    synced_at=synced_at,
                )
            )
        for external_id, timestamp in (
            ("early", bucket_start + timedelta(minutes=1)),
            ("late", bucket_start + timedelta(minutes=3)),
        ):
            await create_event(
                save_fixture,
                organization=organization,
                timestamp=timestamp,
                external_customer_id="alice",
                external_id=external_id,
            )

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.receive_json()
            await websocket.send_json(
                {
                    "type": "confirm",
                    "payload": {
                        "reducer_id": str(reducer.id),
                        "external_customer_id": "alice",
                        "bucket_start": to_epoch_microseconds(bucket_start),
                        "meter_id": str(meter.id),
                        "ids": ["early", "late"],
                    },
                }
            )
            response = await websocket.receive_json(timeout=2)

        assert response["payload"]["ids"] == ["early"]
        assert response["payload"]["snapshot"]["cold_until"] == to_epoch_microseconds(
            bucket_start
        )

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_confirm_pending_bucket_not_synced(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        bucket_start = get_reducer_bucket_start(utc_now()) - timedelta(minutes=30)
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=bucket_start + timedelta(seconds=1),
            external_customer_id="alice",
            external_id="ingested",
        )

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.receive_json()
            await websocket.send_json(
                {
                    "type": "confirm",
                    "payload": {
                        "reducer_id": str(reducer.id),
                        "external_customer_id": "alice",
                        "bucket_start": to_epoch_microseconds(bucket_start),
                        "meter_id": str(meter.id),
                        "ids": ["ingested"],
                    },
                }
            )
            response = await websocket.receive_json(timeout=2)

        # Nothing synced, so nothing confirmed: the snapshot leaves the bucket hot, where
        # the local copy counts the event, pending or not.
        assert response["type"] == "confirmed"
        assert response["payload"]["ids"] == []
        assert response["payload"]["snapshot"]["cold_until"] <= to_epoch_microseconds(
            bucket_start
        )

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_confirm_pending_bucket_start_out_of_range(
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
            await websocket.send_json(
                {
                    "type": "confirm",
                    "payload": {
                        "reducer_id": str(reducer.id),
                        "external_customer_id": "alice",
                        "bucket_start": 10**24,
                        "meter_id": str(meter.id),
                        "ids": ["event"],
                    },
                }
            )
            # The message is invalid and dropped: the next answer is to the next request.
            await websocket.send_json({"type": "configuration"})
            response = await websocket.receive_json(timeout=2)

        assert response["type"] == "configuration"

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_confirm_pending_too_many_ids(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        bucket_start = get_reducer_bucket_start(utc_now()) - timedelta(minutes=30)

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.receive_json()
            await websocket.send_json(
                {
                    "type": "confirm",
                    "payload": {
                        "reducer_id": str(reducer.id),
                        "external_customer_id": "alice",
                        "bucket_start": to_epoch_microseconds(bucket_start),
                        "meter_id": str(meter.id),
                        "ids": [f"event-{index}" for index in range(1001)],
                    },
                }
            )
            # The message is invalid and dropped: the next answer is to the next request.
            await websocket.send_json({"type": "configuration"})
            response = await websocket.receive_json(timeout=2)

        assert response["type"] == "configuration"


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


def _metrics_request(**attributes: str) -> ExportMetricsServiceRequest:
    request = ExportMetricsServiceRequest()
    resource_metrics = request.resource_metrics.add()
    for key, value in attributes.items():
        resource_metrics.resource.attributes.add(
            key=key, value=AnyValue(string_value=value)
        )
    return request


@pytest.mark.anyio
class TestTelemetryMetrics:
    async def test_anonymous(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/v1/outpost/telemetry/metrics",
            content=_metrics_request().SerializeToString(),
            headers={"Content-Type": "application/x-protobuf"},
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_invalid_body(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/v1/outpost/telemetry/metrics",
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
            "/v1/outpost/telemetry/metrics",
            content=_metrics_request(
                **{"polar.organization_id": "spoofed", "service.name": "other"}
            ).SerializeToString(),
            headers={"Content-Type": "application/x-protobuf"},
        )

        assert response.status_code == 200
        forwarded = ExportMetricsServiceRequest()
        forwarded.ParseFromString(forward_mock.call_args.kwargs["body"])
        attributes = {
            attribute.key: attribute.value.string_value
            for attribute in forwarded.resource_metrics[0].resource.attributes
        }
        assert attributes == {
            "polar.organization_id": str(organization.id),
            "service.name": "outpost",
            "deployment.environment.name": "testing",
        }
        assert forward_mock.call_args.kwargs["path"] == "/v1/metrics"
