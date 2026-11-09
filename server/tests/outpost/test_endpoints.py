import json
import typing
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import anyio
import httpx
import httpx_ws
import pytest
from fastapi import FastAPI
from logfire._internal.forwarding import ForwardExportRequestResponse
from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import (
    ExportMetricsServiceRequest,
)
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.common.v1.common_pb2 import AnyValue
from pytest_mock import MockerFixture
from sqlalchemy import event as sqlalchemy_event

from polar.auth.dependencies import _get_auth_subject_factory
from polar.auth.scope import Scope
from polar.kit.utils import utc_now
from polar.meter.aggregation import UniqueAggregation
from polar.models import (
    Customer,
    Meter,
    Organization,
    ReducerBucket,
    StagedEvent,
)
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.outpost.schemas import to_epoch_microseconds
from polar.outpost.service import SYNCED_LOOKBACK
from polar.outpost.service import outpost as outpost_service
from polar.outpost.stream import publish
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import get_reducer_bucket_start
from tests.fixtures import AuthSubjectFixture, SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_customer,
    create_event,
    create_meter,
    create_reducer,
)


@pytest.mark.anyio
@pytest.mark.websocket
class TestOutpost:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="anonymous"),
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="customer"),
        AuthSubjectFixture(subject="agent"),
    )
    async def test_unauthorized_subject(self, client: httpx.AsyncClient) -> None:
        with pytest.raises(httpx_ws.WebSocketUpgradeError) as exc:
            async with httpx_ws.aconnect_ws("/v1/outpost/", client=client):
                pass
        assert exc.value.response.status_code == 401
        assert exc.value.response.json() == {
            "error": "Unauthorized",
            "detail": "Unauthorized",
        }
        assert exc.value.response.headers["WWW-Authenticate"].startswith("Bearer ")

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read})
    )
    async def test_insufficient_scope(self, client: httpx.AsyncClient) -> None:
        with pytest.raises(httpx_ws.WebSocketUpgradeError) as exc:
            async with httpx_ws.aconnect_ws("/v1/outpost/", client=client):
                pass
        assert exc.value.response.status_code == 403
        assert exc.value.response.json()["error"] == "insufficient_scope"
        assert 'scope="events:write"' in exc.value.response.headers["WWW-Authenticate"]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.events_write})
    )
    async def test_connection(self, app: FastAPI, client: httpx.AsyncClient) -> None:
        app.dependency_overrides.pop(
            _get_auth_subject_factory(frozenset({Organization}))
        )
        websocket: httpx_ws.AsyncWebSocketSession
        async with httpx_ws.aconnect_ws(
            "/v1/outpost/", client=client, headers={"Authorization": "Bearer test"}
        ) as websocket:
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
    async def test_request_configuration_without_unique_reducers(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        visitors = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            name="Visitors",
            aggregation=UniqueAggregation(property="visitor"),
        )
        await create_reducer(save_fixture, organization=organization, meters=[visitors])

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.receive_json()
            await websocket.send_json({"type": "configuration"})
            response = await websocket.receive_json()

        assert [payload["id"] for payload in response["payload"]["reducers"]] == [
            str(reducer.id)
        ]

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_request_answered_while_an_earlier_one_is_handled(
        self, client: httpx.AsyncClient, mocker: MockerFixture
    ) -> None:
        released = anyio.Event()
        handle_incoming_message = outpost_service.handle_incoming_message

        async def handle(*args: typing.Any) -> None:
            if json.loads(args[2])["type"] == "meter_usage":
                await released.wait()
            await handle_incoming_message(*args)

        mocker.patch.object(outpost_service, "handle_incoming_message", handle)

        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.receive_json()
            await websocket.send_json(
                {
                    "type": "meter_usage",
                    "payload": {
                        "reducer_id": str(uuid.uuid4()),
                        "external_customer_id": "alice",
                    },
                }
            )
            await websocket.send_json({"type": "configuration"})
            try:
                response = await websocket.receive_json(timeout=2)
            finally:
                released.set()

        assert response["type"] == "configuration"

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.parametrize("customer_key", ["customer_id", "external_customer_id"])
    async def test_request_meter_usage(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        customer_external_id: Customer,
        meter: Meter,
        customer_key: str,
    ) -> None:
        customer = customer_external_id
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
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
                        "reducer_id": str(reducer.id),
                    },
                }
            )
            responses = [await websocket.receive_json(timeout=2) for _ in range(3)]

        payloads = {
            (payload["customer_id"], payload["external_customer_id"]): payload
            for payload in (response["payload"] for response in responses)
        }
        assert payloads.keys() == {
            (str(customer.id), None),
            (None, customer.external_id),
            (str(customer.id), customer.external_id),
        }
        assert all(p["reducer_id"] == str(reducer.id) for p in payloads.values())
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
    @pytest.mark.parametrize("customer_key", ["customer_id", "external_customer_id"])
    async def test_request_credit_usage(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        customer_external_id: Customer,
        meter: Meter,
        customer_key: str,
    ) -> None:
        customer = customer_external_id
        reducer = await create_reducer(
            save_fixture,
            organization=organization,
            meters=[meter],
            kind=ReducerKind.credit,
        )
        current = get_reducer_bucket_start(utc_now())
        for bucket_start, units, sealed in (
            # Before the latest reset.
            (current - timedelta(hours=3), 100, True),
            # Older than the synced lookback.
            (current - SYNCED_LOOKBACK - timedelta(hours=1), 10, False),
            (current, 5, False),
        ):
            bucket_end = bucket_start + timedelta(minutes=5)
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer=customer,
                    bucket_start=bucket_start,
                    bucket_end=bucket_end,
                    count=1,
                    sum=Decimal(units),
                    min=Decimal(units),
                    max=Decimal(units),
                    sealed_at=bucket_end if sealed else None,
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
                        "reducer_id": str(reducer.id),
                    },
                }
            )
            responses = [await websocket.receive_json(timeout=2) for _ in range(3)]

        payloads = [response["payload"] for response in responses]
        assert {(p["customer_id"], p["external_customer_id"]) for p in payloads} == {
            (str(customer.id), None),
            (None, customer.external_id),
            (str(customer.id), customer.external_id),
        }
        for payload in payloads:
            assert payload["reducer_id"] == str(reducer.id)
            assert payload["cold_until"] == payload["version"]
            assert (payload["count"], payload["sum"]) == (2, 15.0)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_request_meter_usage_unknown_customer(
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
                    "type": "meter_usage",
                    "payload": {
                        "external_customer_id": "unknown",
                        "reducer_id": str(reducer.id),
                    },
                }
            )
            response = await websocket.receive_json(timeout=2)

        assert response["payload"]["external_customer_id"] == "unknown"
        assert response["payload"]["customer_exists"] is False

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_event_reducer_bucket(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        redis: Redis,
        organization: Organization,
        customer_external_id: Customer,
        meter: Meter,
    ) -> None:
        customer = customer_external_id
        external_id = customer.external_id
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
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

            response = await websocket.receive_json(timeout=2)

        payload = response["payload"]
        assert isinstance(payload.pop("version"), int)
        assert response == {
            "type": "meter_usage",
            "payload": {
                "reducer_id": str(reducer.id),
                "customer_id": None,
                "external_customer_id": external_id,
                "customer_exists": True,
                "cold_until": to_epoch_microseconds(cold_until),
                "count": 2,
                "sum": 7.0,
                "min": 3.0,
                "max": 4.0,
            },
        }

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_event_credit_reducer_bucket(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        redis: Redis,
        organization: Organization,
        customer_external_id: Customer,
        meter: Meter,
    ) -> None:
        customer = customer_external_id
        reducer = await create_reducer(
            save_fixture,
            organization=organization,
            meters=[meter],
            kind=ReducerKind.credit,
        )
        bucket_start = get_reducer_bucket_start(utc_now())
        await save_fixture(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                customer=customer,
                bucket_start=bucket_start,
                bucket_end=bucket_start + timedelta(minutes=5),
                count=1,
                sum=Decimal(10),
                min=Decimal(10),
                max=Decimal(10),
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
                    "customer_id": customer.id,
                    "external_customer_id": None,
                },
            )
            responses = [await websocket.receive_json(timeout=2) for _ in range(3)]

        payloads = [response["payload"] for response in responses]
        assert {(p["customer_id"], p["external_customer_id"]) for p in payloads} == {
            (str(customer.id), None),
            (None, customer.external_id),
            (str(customer.id), customer.external_id),
        }
        assert all((p["count"], p["sum"]) == (1, 10.0) for p in payloads)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_event_reducer_bucket_split_half_synced(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        redis: Redis,
        organization: Organization,
        customer_external_id: Customer,
        meter: Meter,
    ) -> None:
        external_id = customer_external_id.external_id
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
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
            response = await websocket.receive_json(timeout=2)

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
        customer_external_id: Customer,
        meter: Meter,
    ) -> None:
        external_id = customer_external_id.external_id
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
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

            response = await websocket.receive_json(timeout=2)

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
                    "reducer_id": str(reducer.id),
                    "customer_id": None,
                    "external_customer_id": "alice",
                    "customer_exists": False,
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
                        "ids": [f"event-{index}" for index in range(1001)],
                    },
                }
            )
            # The message is invalid and dropped: the next answer is to the next request.
            await websocket.send_json({"type": "configuration"})
            response = await websocket.receive_json(timeout=2)

        assert response["type"] == "configuration"


async def _append_change(
    redis: Redis, organization: Organization, event: dict[str, typing.Any]
) -> None:
    await redis.xadd(
        f"outpost:changes:{organization.id}",
        {"event": json.dumps(event, default=str)},
    )


async def _get_changes(
    client: httpx.AsyncClient, cursor: str | None = None, **params: typing.Any
) -> dict[str, typing.Any]:
    response = await client.get(
        "/v1/outpost/changes",
        params={**({"cursor": cursor} if cursor is not None else {}), **params},
    )
    assert response.status_code == 200
    return response.json()


async def _save_synced_bucket(
    save_fixture: SaveFixture,
    organization: Organization,
    reducer: typing.Any,
    external_customer_id: str,
    value: int,
) -> datetime:
    bucket_start = get_reducer_bucket_start(utc_now()) - timedelta(minutes=30)
    bucket_end = bucket_start + timedelta(minutes=5)
    await save_fixture(
        ReducerBucket(
            organization=organization,
            reducer=reducer,
            external_customer_id=external_customer_id,
            bucket_start=bucket_start,
            bucket_end=bucket_end,
            count=1,
            sum=Decimal(value),
            min=Decimal(value),
            max=Decimal(value),
            synced_at=bucket_end,
        )
    )
    return bucket_end


@pytest.mark.anyio
class TestChanges:
    async def test_anonymous(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/v1/outpost/changes")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_without_cursor(
        self, client: httpx.AsyncClient, redis: Redis, organization: Organization
    ) -> None:
        await _append_change(redis, organization, {"type": "configuration"})

        changes = await _get_changes(client)

        assert changes["changes"] == []
        assert changes["has_more"] is False
        assert changes["reset"] is False
        assert changes["configuration_changed"] is False
        assert changes["next_poll_in"] == 30
        assert (await _get_changes(client, changes["cursor"]))["changes"] == []

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_idle_poll_reads_no_reducer(
        self, mocker: MockerFixture, client: httpx.AsyncClient
    ) -> None:
        cursor = (await _get_changes(client))["cursor"]
        get_reducers = mocker.spy(
            ReducerRepository, "get_all_active_by_organization_and_kinds"
        )

        changes = await _get_changes(client, cursor)

        assert changes["changes"] == []
        get_reducers.assert_not_called()

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_changes_since_cursor(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        client: httpx.AsyncClient,
        redis: Redis,
        organization: Organization,
        customer_external_id: Customer,
        meter: Meter,
    ) -> None:
        external_id = customer_external_id.external_id
        assert external_id is not None
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        bucket_end = await _save_synced_bucket(
            save_fixture, organization, reducer, external_id, 4
        )
        cursor = (await _get_changes(client))["cursor"]
        event = {
            "type": "reducer_bucket",
            "reducer_id": str(reducer.id),
            "customer_id": None,
            "external_customer_id": external_id,
        }
        for _ in range(3):
            await _append_change(redis, organization, event)
        get_meter_usage = mocker.spy(outpost_service, "_get_meter_usage")

        changes = await _get_changes(client, cursor)

        get_meter_usage.assert_called_once()
        [change] = changes["changes"]
        assert isinstance(change.pop("version"), int)
        assert change == {
            "reducer_id": str(reducer.id),
            "customer_id": None,
            "external_customer_id": external_id,
            "customer_exists": True,
            "cold_until": to_epoch_microseconds(bucket_end),
            "count": 1,
            "sum": 4.0,
            "min": 4.0,
            "max": 4.0,
        }
        assert changes["has_more"] is False
        assert (await _get_changes(client, changes["cursor"]))["changes"] == []

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_queries_do_not_grow_with_the_changes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: httpx.AsyncClient,
        redis: Redis,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        external_ids = ["alice", "bob", "carol"]
        for value, external_id in enumerate(external_ids, start=1):
            await create_customer(
                save_fixture,
                organization=organization,
                external_id=external_id,
                email=f"{external_id}@example.com",
            )
            await _save_synced_bucket(
                save_fixture, organization, reducer, external_id, value
            )
        queries = 0

        def count_query(*args: typing.Any) -> None:
            nonlocal queries
            queries += 1

        bind = session.sync_session.bind
        assert bind is not None
        cursor = (await _get_changes(client))["cursor"]
        pages = []
        for page in (external_ids[:1], external_ids):
            for external_id in page:
                await _append_change(
                    redis,
                    organization,
                    {
                        "type": "reducer_bucket",
                        "reducer_id": str(reducer.id),
                        "customer_id": None,
                        "external_customer_id": external_id,
                    },
                )
            queries = 0
            sqlalchemy_event.listen(bind, "before_cursor_execute", count_query)
            try:
                changes = await _get_changes(client, cursor)
            finally:
                sqlalchemy_event.remove(bind, "before_cursor_execute", count_query)
            cursor = changes["cursor"]
            pages.append((changes["changes"], queries))

        [(_, one), (changes, three)] = pages
        assert three == one
        assert {
            change["external_customer_id"]: change["sum"] for change in changes
        } == {"alice": 1.0, "bob": 2.0, "carol": 3.0}

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_credit_change_for_each_identity(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        redis: Redis,
        organization: Organization,
        customer_external_id: Customer,
        meter: Meter,
    ) -> None:
        customer = customer_external_id
        reducer = await create_reducer(
            save_fixture,
            organization=organization,
            meters=[meter],
            kind=ReducerKind.credit,
        )
        cursor = (await _get_changes(client))["cursor"]
        await _append_change(
            redis,
            organization,
            {
                "type": "reducer_bucket",
                "reducer_id": str(reducer.id),
                "customer_id": str(customer.id),
                "external_customer_id": None,
            },
        )

        changes = await _get_changes(client, cursor)

        assert {
            (change["customer_id"], change["external_customer_id"])
            for change in changes["changes"]
        } == {
            (str(customer.id), None),
            (None, customer.external_id),
            (str(customer.id), customer.external_id),
        }

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_limit(
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
        cursor = (await _get_changes(client))["cursor"]
        for external_id in ("alice", "bob"):
            await _append_change(
                redis,
                organization,
                {
                    "type": "reducer_bucket",
                    "reducer_id": str(reducer.id),
                    "customer_id": None,
                    "external_customer_id": external_id,
                },
            )

        first = await _get_changes(client, cursor, limit=1)
        second = await _get_changes(client, first["cursor"], limit=1)

        assert first["has_more"] is True
        assert [c["external_customer_id"] for c in first["changes"]] == ["alice"]
        assert second["has_more"] is False
        assert [c["external_customer_id"] for c in second["changes"]] == ["bob"]

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_configuration_changed(
        self, client: httpx.AsyncClient, redis: Redis, organization: Organization
    ) -> None:
        cursor = (await _get_changes(client))["cursor"]
        await _append_change(redis, organization, {"type": "configuration"})

        changes = await _get_changes(client, cursor)

        assert changes["configuration_changed"] is True
        assert changes["changes"] == []

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_reset_when_the_cursor_is_too_old(
        self, client: httpx.AsyncClient, redis: Redis, organization: Organization
    ) -> None:
        await _append_change(redis, organization, {"type": "configuration"})

        changes = await _get_changes(client, "1-0")

        assert changes["reset"] is True
        assert changes["configuration_changed"] is False
        assert (await _get_changes(client, changes["cursor"]))["reset"] is False

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.parametrize(
        "cursor",
        ["not-a-cursor", f"{2**64}-0", f"0-{2**64}"],
    )
    async def test_invalid_cursor(self, client: httpx.AsyncClient, cursor: str) -> None:
        response = await client.get("/v1/outpost/changes", params={"cursor": cursor})

        assert response.status_code == 422


@pytest.mark.anyio
class TestRequests:
    async def test_anonymous(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/v1/outpost/configuration")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_configuration(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        visitors = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            name="Visitors",
            aggregation=UniqueAggregation(property="visitor"),
        )
        await create_reducer(save_fixture, organization=organization, meters=[visitors])

        response = await client.get("/v1/outpost/configuration")

        assert response.status_code == 200
        configuration = response.json()
        assert configuration["organization_id"] == str(organization.id)
        [payload] = configuration["reducers"]
        assert payload["id"] == str(reducer.id)
        assert payload["meter_ids"] == [str(meter.id)]

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.parametrize("customer_key", ["customer_id", "external_customer_id"])
    async def test_meter_usage(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        customer_external_id: Customer,
        meter: Meter,
        customer_key: str,
    ) -> None:
        customer = customer_external_id
        assert customer.external_id is not None
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        bucket_end = await _save_synced_bucket(
            save_fixture, organization, reducer, customer.external_id, 4
        )

        customer_value = {
            "customer_id": str(customer.id),
            "external_customer_id": customer.external_id,
        }[customer_key]

        response = await client.post(
            "/v1/outpost/meter-usage",
            json={
                "identities": [
                    {"reducer_id": str(reducer.id), customer_key: customer_value}
                ]
            },
        )

        assert response.status_code == 200
        payloads = {
            (payload["customer_id"], payload["external_customer_id"]): payload
            for payload in response.json()
        }
        assert payloads.keys() == {
            (str(customer.id), None),
            (None, customer.external_id),
            (str(customer.id), customer.external_id),
        }
        external = payloads[(None, customer.external_id)]
        assert external["cold_until"] == to_epoch_microseconds(bucket_end)
        assert (external["count"], external["sum"]) == (1, 4.0)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_meter_usage_queries_do_not_grow_with_the_customers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        requests_meter = await create_meter(
            save_fixture, organization=organization, id=uuid.uuid4(), name="Requests"
        )
        reducers = [
            await create_reducer(save_fixture, organization=organization, meters=[m])
            for m in (meter, requests_meter)
        ]
        external_ids = ["alice", "bob", "carol"]
        for value, external_id in enumerate(external_ids, start=1):
            await create_customer(
                save_fixture,
                organization=organization,
                external_id=external_id,
                email=f"{external_id}@example.com",
            )
            for reducer in reducers:
                await _save_synced_bucket(
                    save_fixture, organization, reducer, external_id, value
                )
        queries = 0

        def count_query(*args: typing.Any) -> None:
            nonlocal queries
            queries += 1

        bind = session.sync_session.bind
        assert bind is not None
        answers = []
        for customers in (external_ids[:1], external_ids):
            queries = 0
            sqlalchemy_event.listen(bind, "before_cursor_execute", count_query)
            try:
                response = await client.post(
                    "/v1/outpost/meter-usage",
                    json={
                        "identities": [
                            {"reducer_id": str(reducer.id), "external_customer_id": id}
                            for reducer in reducers
                            for id in customers
                        ]
                    },
                )
            finally:
                sqlalchemy_event.remove(bind, "before_cursor_execute", count_query)
            assert response.status_code == 200
            answers.append((response.json(), queries))

        [(_, one), (snapshots, three)] = answers
        assert three == one
        assert {
            (snapshot["reducer_id"], snapshot["external_customer_id"]): snapshot["sum"]
            for snapshot in snapshots
            if snapshot["customer_id"] is None
        } == {
            (str(reducer.id), external_id): float(value)
            for reducer in reducers
            for value, external_id in enumerate(external_ids, start=1)
        }

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_meter_usage_unknown_reducer(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/v1/outpost/meter-usage",
            json={
                "identities": [
                    {"reducer_id": str(uuid.uuid4()), "external_customer_id": "alice"}
                ]
            },
        )

        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_meter_usage_too_many_identities(
        self, client: httpx.AsyncClient
    ) -> None:
        identity = {"reducer_id": str(uuid.uuid4()), "external_customer_id": "alice"}
        response = await client.post(
            "/v1/outpost/meter-usage", json={"identities": [identity] * 501}
        )

        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_confirm(
        self,
        save_fixture: SaveFixture,
        client: httpx.AsyncClient,
        organization: Organization,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        bucket_end = await _save_synced_bucket(
            save_fixture, organization, reducer, "alice", 1
        )
        bucket_start = bucket_end - timedelta(minutes=5)
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=bucket_start + timedelta(seconds=1),
            external_customer_id="alice",
            external_id="counted",
        )

        response = await client.post(
            "/v1/outpost/confirm",
            json={
                "reducer_id": str(reducer.id),
                "external_customer_id": "alice",
                "bucket_start": to_epoch_microseconds(bucket_start),
                "ids": ["counted", "unknown"],
            },
        )

        assert response.status_code == 200
        confirmed = response.json()
        assert confirmed["ids"] == ["counted"]
        assert confirmed["external_customer_id"] == "alice"
        assert (confirmed["snapshot"]["count"], confirmed["snapshot"]["sum"]) == (
            1,
            1.0,
        )

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_confirm_too_many_ids(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/v1/outpost/confirm",
            json={
                "reducer_id": str(uuid.uuid4()),
                "external_customer_id": "alice",
                "bucket_start": 0,
                "ids": [f"event-{index}" for index in range(1001)],
            },
        )

        assert response.status_code == 422


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

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.events_read})
    )
    async def test_insufficient_scope(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/v1/outpost/telemetry",
            content=_export_request().SerializeToString(),
            headers={"Content-Type": "application/x-protobuf"},
        )

        assert response.status_code == 403
        assert response.json()["error"] == "insufficient_scope"
        assert 'scope="events:write"' in response.headers["WWW-Authenticate"]

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
