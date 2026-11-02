import collections.abc
import copy
import dataclasses
import datetime
import functools
import itertools
import json
import typing
from unittest.mock import DEFAULT, AsyncMock

import anyio
import anyio.lowlevel
import httpx
import pytest
from fakeredis import FakeAsyncRedis, FakeServer
from httpx_ws.transport import ASGIWebSocketTransport
from opentelemetry.sdk.metrics.export import (
    ExponentialHistogramDataPoint,
    MetricExporter,
    MetricExportResult,
    MetricsData,
)
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    SimpleSpanProcessor,
    SpanExporter,
    SpanExportResult,
)
from redis.asyncio import Redis
from redis.asyncio.client import PubSub
from redis.exceptions import AuthenticationError, AuthorizationError, ResponseError
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

from polar import __version__
from polar.metering import EventInput
from polar.outpost.client import (
    APPLY_SNAPSHOT_SCRIPT,
    WRITE_BUCKET_SCRIPT,
    MissingExternalIdError,
    Outpost,
    PolarOutpostError,
    RedisReconnectBackoff,
    ReducerState,
    UnavailableRedisError,
    _backoff_delay,
    _is_connection_error,
    _NotReadyError,
    _number,
    connect_websocket,
    decode_state,
)
from polar.outpost.reducer import BUCKET_SIZE, get_bucket_start
from polar.outpost.telemetry import TELEMETRY_ENV

CONNECTION_ID = "5b6e1f0c-8f4c-4d2a-9a51-3c7d2e8b1f60"
_ids = itertools.count(1)
TIMESTAMP = "2026-10-12T12:00:00Z"
BUCKET = get_bucket_start(datetime.datetime.fromisoformat(TIMESTAMP))
CONFIGURATION: dict[str, typing.Any] = {
    "reducers": [
        {
            "id": "tokens",
            "kind": "usage",
            "meter_ids": ["meter"],
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "sum", "property": "tokens"},
        },
        {
            "id": "credits",
            "kind": "credit",
            "meter_ids": ["meter"],
            "filter": {
                "conjunction": "and",
                "clauses": [
                    {"property": "source", "operator": "eq", "value": "system"},
                    {"property": "name", "operator": "eq", "value": "meter.credited"},
                    {"property": "meter_id", "operator": "eq", "value": "meter"},
                ],
            },
            "aggregation": {"func": "sum", "property": "units"},
        },
    ],
}


@pytest.fixture
async def redis_connection(
    monkeypatch: pytest.MonkeyPatch,
) -> collections.abc.AsyncIterator[tuple[str, Redis]]:
    server = FakeServer()
    monkeypatch.setattr(
        "polar.outpost.client.Redis.from_url",
        lambda url, **kwargs: FakeAsyncRedis(server=server, **kwargs),
    )
    async with FakeAsyncRedis(server=server) as redis:
        yield "redis://localhost:6379", redis


@pytest.fixture(autouse=True)
def short_snapshot_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("polar.outpost.client.SNAPSHOT_TIMEOUT", 0.1)


@pytest.fixture(autouse=True)
def exported_spans(monkeypatch: pytest.MonkeyPatch) -> list[ReadableSpan]:
    exported: list[ReadableSpan] = []

    class Exporter(SpanExporter):
        def export(
            self, spans: collections.abc.Sequence[ReadableSpan]
        ) -> SpanExportResult:
            exported.extend(spans)
            return SpanExportResult.SUCCESS

    monkeypatch.delenv(TELEMETRY_ENV, raising=False)
    monkeypatch.setattr(
        "polar.outpost.telemetry.RelaySpanExporter", lambda *_: Exporter()
    )
    monkeypatch.setattr(
        "polar.outpost.telemetry.BatchSpanProcessor", SimpleSpanProcessor
    )
    return exported


@pytest.fixture(autouse=True)
def exported_metrics(monkeypatch: pytest.MonkeyPatch) -> list[MetricsData]:
    exported: list[MetricsData] = []

    class Exporter(MetricExporter):
        def export(
            self,
            metrics_data: MetricsData,
            timeout_millis: float = 10_000,
            **kwargs: typing.Any,
        ) -> MetricExportResult:
            exported.append(metrics_data)
            return MetricExportResult.SUCCESS

        def force_flush(self, timeout_millis: float = 10_000) -> bool:
            return True

        def shutdown(
            self, timeout_millis: float = 30_000, **kwargs: typing.Any
        ) -> None:
            pass

    monkeypatch.setattr(
        "polar.outpost.telemetry.RelayMetricExporter", lambda *_: Exporter()
    )
    return exported


def _data_points(exported: list[MetricsData], name: str) -> list[typing.Any]:
    return [
        point
        for metrics_data in exported
        for resource_metrics in metrics_data.resource_metrics
        for scope_metrics in resource_metrics.scope_metrics
        for metric in scope_metrics.metrics
        if metric.name == name
        for point in metric.data.data_points
    ]


async def _credit(
    redis: Redis, units: int, customer: str = "external:alice", reducer: str = "credits"
) -> None:
    await redis.hset(
        f"outpost:v1:state:{customer}:{reducer}",
        mapping={"cold_until": BUCKET, "cold:sum": units},
    )


@pytest.fixture
def configuration() -> dict[str, typing.Any]:
    return copy.deepcopy(CONFIGURATION)


@pytest.fixture
def snapshots() -> dict[str, dict[str, typing.Any]]:
    return {}


@pytest.fixture
def websocket_requests() -> list[dict[str, typing.Any]]:
    return []


@pytest.fixture
def configuration_gates() -> list[anyio.Event]:
    return []


# Polar's side of each open WebSocket, to push a message no request asked for.
@pytest.fixture
def polar_sends() -> list[typing.Any]:
    return []


# The events Polar counted: a confirm request is answered with the ids among them and the
# snapshot read with them, the requested customer's unless overridden.
@pytest.fixture
def ingested() -> set[str]:
    return set()


@pytest.fixture
def confirmations() -> dict[str, typing.Any]:
    return {"answer": True, "snapshot": None}


@pytest.fixture
async def polar_client(
    configuration: dict[str, typing.Any],
    snapshots: dict[str, dict[str, typing.Any]],
    websocket_requests: list[dict[str, typing.Any]],
    configuration_gates: list[anyio.Event],
    ingested: set[str],
    confirmations: dict[str, typing.Any],
    polar_sends: list[typing.Any],
) -> collections.abc.AsyncIterator[httpx.AsyncClient]:
    async def app(scope: typing.Any, receive: typing.Any, send: typing.Any) -> None:
        assert (b"authorization", b"Bearer test-token") in scope["headers"]
        assert (await receive())["type"] == "websocket.connect"
        await send({"type": "websocket.accept"})
        polar_sends.append(send)
        await send(
            {
                "type": "websocket.send",
                "text": json.dumps(
                    {"type": "connection", "payload": {"id": CONNECTION_ID}}
                ),
            }
        )
        while True:
            message = await receive()
            if message["type"] == "websocket.disconnect":
                return
            request = json.loads(message["text"])
            websocket_requests.append(request)
            if request["type"] == "configuration":
                for gate in configuration_gates:
                    await gate.wait()
                await send(
                    {
                        "type": "websocket.send",
                        "text": json.dumps(
                            {
                                "type": "configuration",
                                "payload": configuration,
                            }
                        ),
                    }
                )
            elif request["type"] == "meter_usage":
                payload = request["payload"]
                kind = "customer" if "customer_id" in payload else "external"
                identifier = payload.get(
                    "customer_id", payload.get("external_customer_id")
                )
                reducer_id = payload["reducer_id"]
                snapshot = snapshots.get(f"{kind}:{identifier}:{reducer_id}")
                if snapshot is not None:
                    await send(
                        {
                            "type": "websocket.send",
                            "text": json.dumps(
                                {
                                    "type": "meter_usage",
                                    "payload": {
                                        "customer_exists": True,
                                        **snapshot,
                                        "reducer_id": reducer_id,
                                    },
                                }
                            ),
                        }
                    )
            elif request["type"] == "confirm" and confirmations["answer"]:
                payload = request["payload"]
                kind = "customer" if "customer_id" in payload else "external"
                identifier = payload.get(
                    "customer_id", payload.get("external_customer_id")
                )
                reducer_id = payload["reducer_id"]
                answered = (
                    confirmations["snapshot"]
                    or snapshots[f"{kind}:{identifier}:{reducer_id}"]
                )
                await send(
                    {
                        "type": "websocket.send",
                        "text": json.dumps(
                            {
                                "type": "confirmed",
                                "payload": {
                                    "reducer_id": reducer_id,
                                    "customer_id": payload.get("customer_id"),
                                    "external_customer_id": payload.get(
                                        "external_customer_id"
                                    ),
                                    "bucket_start": payload["bucket_start"],
                                    "ids": [
                                        external_id
                                        for external_id in payload["ids"]
                                        if external_id in ingested
                                    ],
                                    "snapshot": {
                                        "customer_exists": True,
                                        **answered,
                                        "reducer_id": reducer_id,
                                    },
                                },
                            }
                        ),
                    }
                )

    async with httpx.AsyncClient(
        base_url="http://polar.test",
        headers={"Authorization": "Bearer test-token"},
        transport=ASGIWebSocketTransport(app),
    ) as client:
        yield client


@pytest.mark.anyio
async def test_ingest_accepts_single_events(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, redis = redis_connection
    events: list[EventInput] = [
        {
            "name": "call",
            "external_customer_id": "alice",
            "timestamp": TIMESTAMP,
            "external_id": "event-1",
            "metadata": {"tokens": 3},
        },
        {
            "name": "call",
            "external_id": f"event-{next(_ids)}",
            "customer_id": "alice",
            "metadata": {"tokens": 5},
        },
    ]
    async with Outpost(url, client=polar_client) as outpost:
        for event in events:
            assert await outpost.track(event) is None
    field = f"bucket:{BUCKET}:sum"
    assert await redis.hget("outpost:v1:state:external:alice:tokens", field) == b"3"
    own = await redis.hgetall("outpost:v1:state:customer:alice:tokens")
    assert any(
        isinstance(field, bytes)
        and field.startswith(b"bucket:")
        and field.endswith(b":sum")
        and value == b"5"
        for field, value in own.items()
    )


@pytest.mark.anyio
async def test_ingest_requires_external_id(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        with pytest.raises(MissingExternalIdError):
            await outpost.track({"name": "call", "external_customer_id": "alice"})


@pytest.mark.anyio
@pytest.mark.parametrize(("bucket_count", "fail"), [(0, False), (3, False), (3, True)])
async def test_ingest_pipelines_buckets(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    configuration: dict[str, typing.Any],
    monkeypatch: pytest.MonkeyPatch,
    bucket_count: int,
    fail: bool,
) -> None:
    url, redis = redis_connection
    reducer, credit = configuration["reducers"]
    configuration["reducers"] = [
        {**reducer, "id": f"tokens-{i}", "meter_ids": [f"meter-{i}"]}
        for i in range(bucket_count)
    ] + [
        {**credit, "id": f"credits-{i}", "meter_ids": [f"meter-{i}"]}
        for i in range(bucket_count)
    ]
    for i in range(bucket_count):
        await redis.hset(
            f"outpost:v1:state:external:alice:tokens-{i}", "cold_until", BUCKET
        )
        await _credit(redis, 100, reducer=f"credits-{i}")
    async with Outpost(url, client=polar_client) as outpost:
        assert outpost._redis is not None
        pipeline = outpost._redis.pipeline(transaction=False)
        execute = AsyncMock(wraps=pipeline.execute)
        monkeypatch.setattr(pipeline, "execute", execute)
        monkeypatch.setattr(outpost._redis, "pipeline", lambda **kwargs: pipeline)
        await outpost.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": TIMESTAMP,
                "metadata": {"tokens": 3},
            }
        )
        execute.assert_awaited_once()
        for i in range(bucket_count):
            meter = await outpost.meter(
                meter_id=f"meter-{i}", external_customer_id="alice"
            )
            assert meter is not None
            assert meter.consumed_units == 3
            assert meter.balance == 97
            assert (
                await redis.hget(
                    f"outpost:v1:state:external:alice:tokens-{i}",
                    f"bucket:{BUCKET}:count",
                )
                == b"1"
            )
        if fail:
            monkeypatch.setattr(outpost, "_channel", "outpost:test:unsubscribed")
            await redis.hset(
                "outpost:v1:state:external:alice:tokens-1",
                f"bucket:{BUCKET}:sum",
                "invalid",
            )
            with pytest.raises(ResponseError):
                await outpost.track(
                    {
                        "name": "call",
                        "external_id": f"event-{next(_ids)}",
                        "external_customer_id": "alice",
                        "timestamp": TIMESTAMP,
                        "metadata": {"tokens": 2},
                    }
                )
            assert execute.await_count == 2
            for i in (0, 2):
                meter = await outpost.meter(
                    meter_id=f"meter-{i}", external_customer_id="alice"
                )
                assert meter is not None
                assert meter.consumed_units == 5
                assert meter.balance == 95
                assert (
                    await redis.hget(
                        f"outpost:v1:state:external:alice:tokens-{i}",
                        f"bucket:{BUCKET}:sum",
                    )
                    == b"5"
                )


@pytest.mark.anyio
@pytest.mark.parametrize("flush_scripts", [False, True])
async def test_ingest_writes_a_single_bucket_without_a_pipeline(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    flush_scripts: bool,
) -> None:
    url, redis = redis_connection
    await redis.hset("outpost:v1:state:external:alice:tokens", "cold_until", BUCKET)
    await _credit(redis, 100)
    async with Outpost(url, client=polar_client) as outpost:
        assert outpost._redis is not None
        # Redis no longer has the script cached: the write falls back to EVAL.
        if flush_scripts:
            await redis.script_flush()
        monkeypatch.setattr(
            outpost._redis,
            "pipeline",
            lambda **kwargs: pytest.fail("one bucket needs no pipeline"),
        )
        await outpost.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": TIMESTAMP,
                "metadata": {"tokens": 3},
            }
        )
        meter = await outpost.meter(meter_id="meter", external_customer_id="alice")
        assert meter is not None
        assert meter.consumed_units == 3
        assert meter.balance == 97
        assert (
            await redis.hget(
                "outpost:v1:state:external:alice:tokens", f"bucket:{BUCKET}:count"
            )
            == b"1"
        )


@pytest.mark.anyio
async def test_connection_id_is_retained_while_connected(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, _ = redis_connection
    outpost = Outpost(url, client=polar_client)
    async with outpost:
        await outpost.track(
            {"name": "call", "external_customer_id": "alice", "external_id": "event"}
        )
        assert outpost.connection_id == CONNECTION_ID
    assert outpost.connection_id is None


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("func", "expected"),
    [("count", 4), ("sum", 4), ("min", -2), ("max", 4), ("avg", 1)],
)
async def test_customer_meter_reads_cold_and_shared_buckets(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    func: str,
    expected: int,
    websocket_requests: list[dict[str, typing.Any]],
    configuration: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    configuration["reducers"][0]["aggregation"]["func"] = func
    await redis.hset(
        "outpost:v1:state:external:alice:tokens",
        mapping={
            "cold_until": BUCKET,
            "cold:count": 2,
            "cold:sum": 2,
            "cold:min": 2,
            "cold:max": 2,
            f"bucket:{BUCKET - BUCKET_SIZE}:sum": 999,
        },
    )
    await _credit(redis, 20)
    async with (
        Outpost(url, client=polar_client) as writer,
        Outpost(url, client=polar_client) as reader,
    ):
        await reader.actor(external_customer_id="alice")
        for value in (-2, 4):
            await writer.track(
                {
                    "name": "call",
                    "external_id": f"event-{next(_ids)}",
                    "external_customer_id": "alice",
                    "timestamp": TIMESTAMP,
                    "metadata": {"tokens": value},
                }
            )
        own_meter = await writer.meter(external_customer_id="alice", meter_id="meter")
        assert own_meter is not None and own_meter.consumed_units == expected
        with anyio.fail_after(1):
            while True:
                meter = await reader.meter(
                    external_customer_id="alice", meter_id="meter"
                )
                if meter is not None and meter.consumed_units == expected:
                    break
                await anyio.lowlevel.checkpoint()
    assert meter is not None
    assert meter.consumed_units == expected
    assert meter.credited_units == 20
    assert meter.balance == 20 - expected
    assert (
        sum(message["type"] == "configuration" for message in websocket_requests) == 2
    )
    assert not polar_client.is_closed


@pytest.mark.anyio
async def test_bucket_ownership_and_internal_customer(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, redis = redis_connection
    await redis.hset(
        "outpost:v1:state:customer:alice:tokens",
        mapping={
            "cold_until": BUCKET,
            "cold:sum": 10,
        },
    )
    await _credit(redis, 100, customer="customer:alice")
    async with Outpost(url, client=polar_client) as outpost:
        events: list[EventInput] = [
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "customer_id": "alice",
                "timestamp": "2026-10-12T11:59:59Z",
                "metadata": {"tokens": 999},
            },
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "customer_id": "alice",
                "timestamp": TIMESTAMP,
                "metadata": {"tokens": 2},
            },
        ]
        for event in events:
            await outpost.track(event)
        meter = await outpost.meter(customer_id="alice", meter_id="meter")
    assert meter is not None
    assert meter.customer_id == "alice"
    # The late event counts as pending until Polar confirms it.
    assert meter.consumed_units == 12 + 999
    assert (
        await redis.hget(
            "outpost:v1:state:customer:alice:tokens",
            f"bucket:{BUCKET - BUCKET_SIZE}:sum",
        )
        == b"999"
    )


@pytest.mark.anyio
async def test_actor_is_idempotent_and_missing_snapshot_is_not_zero(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    websocket_requests: list[dict[str, typing.Any]],
) -> None:
    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await outpost.actor(external_customer_id="alice")
        assert (
            await outpost.meter(external_customer_id="alice", meter_id="unknown")
            is None
        )
        with pytest.raises(PolarOutpostError, match="snapshot is not ready"):
            await outpost.meter(external_customer_id="alice", meter_id="meter")
    assert [
        message for message in websocket_requests if message["type"] == "meter_usage"
    ] == [
        {
            "type": "meter_usage",
            "payload": {"external_customer_id": "alice", "reducer_id": reducer_id},
        }
        for reducer_id in ("tokens", "credits")
    ]


@pytest.mark.anyio
async def test_concurrent_writers_count_a_repeated_event_once(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, redis = redis_connection
    event: EventInput = {
        "name": "call",
        "external_customer_id": "alice",
        "timestamp": TIMESTAMP,
        "external_id": "same-id",
        "metadata": {"tokens": 1},
    }
    async with (
        Outpost(url, client=polar_client) as first,
        Outpost(url, client=polar_client) as second,
        anyio.create_task_group() as tasks,
    ):
        for outpost in [first, second] * 5:
            tasks.start_soon(outpost.track, event)
    assert (
        await redis.hget(
            "outpost:v1:state:external:alice:tokens", f"bucket:{BUCKET}:sum"
        )
        == b"1"
    )


@pytest.mark.anyio
async def test_startup_does_not_wait_for_configuration(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    configuration_gates: list[anyio.Event],
) -> None:
    url, redis = redis_connection
    gate = anyio.Event()
    configuration_gates.append(gate)
    event: EventInput = {
        "name": "call",
        "external_id": f"event-{next(_ids)}",
        "external_customer_id": "alice",
        "timestamp": TIMESTAMP,
        "metadata": {"tokens": 3},
    }
    with anyio.fail_after(1):
        async with (
            Outpost(url, client=polar_client) as outpost,
            anyio.create_task_group() as tasks,
        ):
            tasks.start_soon(outpost.track, event)
            await anyio.lowlevel.checkpoint()
            assert not await redis.exists("outpost:v1:state:external:alice:tokens")
            gate.set()
    assert (
        await redis.hget(
            "outpost:v1:state:external:alice:tokens", f"bucket:{BUCKET}:sum"
        )
        == b"3"
    )


@pytest.mark.anyio
async def test_snapshot_arrives_over_websocket(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    websocket_requests: list[dict[str, typing.Any]],
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await redis.hset(
        key,
        mapping={
            "cold_until": BUCKET,
            "cold:sum": 100,
            f"bucket:{BUCKET}:sum": 7,
            f"bucket:{BUCKET + BUCKET_SIZE}:sum": 4,
        },
    )
    async with (
        Outpost(url, client=polar_client) as owner,
        Outpost(url, client=polar_client) as reader,
    ):
        await reader.actor(external_customer_id="alice")
        with anyio.fail_after(1):
            while not any(
                message["type"] == "meter_usage" for message in websocket_requests
            ):
                await anyio.lowlevel.checkpoint()
        snapshots["external:alice:tokens"] = {
            "customer_id": None,
            "external_customer_id": "alice",
            "version": 1791807000000000,
            "cold_until": 1791806700000000,
            "count": 2,
            "sum": 107,
            "min": 7,
            "max": 100,
        }
        snapshots["external:alice:credits"] = {
            "customer_id": None,
            "external_customer_id": "alice",
            "version": 1791807000000000,
            "cold_until": 1791807000000000,
            "count": 1,
            "sum": 200,
            "min": 200,
            "max": 200,
        }
        await owner.actor(external_customer_id="alice")
        with anyio.fail_after(1):
            while True:
                meter = await reader.meter(
                    external_customer_id="alice", meter_id="meter"
                )
                if meter is not None and meter.balance == 89:
                    break
                await anyio.lowlevel.checkpoint()
    assert meter is not None
    assert meter.consumed_units == 111
    assert meter.balance == 89
    assert await redis.hget(key, f"bucket:{BUCKET}:sum") is None
    assert await redis.hget(key, f"bucket:{BUCKET + BUCKET_SIZE}:sum") == b"4"


@pytest.mark.anyio
async def test_duplicate_and_older_snapshots(
    redis_connection: tuple[str, Redis],
) -> None:
    _, redis = redis_connection
    apply_snapshot = redis.register_script(APPLY_SNAPSHOT_SCRIPT)
    key = "outpost:v1:state:external:alice:tokens"
    prefix = ["external:alice:tokens", "outpost:v1:0:updates", "epoch"]
    args = [*prefix, BUCKET, 20, 1, 10, 10, 10]
    await apply_snapshot(keys=[key], args=args)
    await apply_snapshot(keys=[key], args=args)
    await apply_snapshot(
        keys=[key], args=[*prefix, BUCKET - BUCKET_SIZE, 30, 1, 999, 999, 999]
    )
    await apply_snapshot(keys=[key], args=[*prefix, BUCKET, 19, 1, 999, 999, 999])
    assert await redis.hget(key, "cold:sum") == b"10"
    await apply_snapshot(keys=[key], args=[*prefix, BUCKET, 21, 0, 0, "", ""])
    assert await redis.hget(key, "cold:min") is None
    assert await redis.hget(key, "cold:max") is None


@pytest.mark.anyio
async def test_warmed_reads_do_not_use_redis(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    await redis.hset(
        "outpost:v1:state:external:alice:tokens",
        mapping={"cold_until": BUCKET, "cold:sum": 10},
    )
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": TIMESTAMP,
                "metadata": {"tokens": 3},
            }
        )

        async def unexpected_command(
            *args: typing.Any, **kwargs: typing.Any
        ) -> typing.Any:
            pytest.fail("A warmed meter read must not issue Redis commands")

        assert outpost._redis is not None
        monkeypatch.setattr(outpost._redis, "execute_command", unexpected_command)
        meter = await outpost.meter(external_customer_id="alice", meter_id="meter")
        assert meter is not None and meter.consumed_units == 13


@pytest.mark.anyio
async def test_ready_reads_do_not_wait_for_a_snapshot(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    await redis.hset(
        "outpost:v1:state:external:alice:tokens",
        mapping={"cold_until": BUCKET, "cold:sum": 10},
    )
    await _credit(redis, 20)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")

        def unexpected_wait(*args: typing.Any, **kwargs: typing.Any) -> typing.Any:
            pytest.fail("A ready read must not wait for a snapshot")

        monkeypatch.setattr("polar.outpost.client.anyio.move_on_after", unexpected_wait)
        await outpost.actor(external_customer_id="alice")
        meter = await outpost.meter(external_customer_id="alice", meter_id="meter")
        assert meter is not None and meter.balance == 10


@pytest.mark.anyio
async def test_old_messages_and_redis_reset_do_not_roll_back_cache(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await redis.hset(
        key,
        mapping={
            "cold_until": BUCKET,
            "cold:sum": 10,
            "epoch": "first",
            "revision": 2**53 + 1,
        },
    )
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        received = anyio.Event()
        original = outpost._receive_state

        async def receive_state(
            customer: str, state: ReducerState, *, bucket: bool = False
        ) -> None:
            await original(customer, state, bucket=bucket)
            if state.cold.sum == 1:
                received.set()

        monkeypatch.setattr(outpost, "_receive_state", receive_state)
        old = {
            "customer": "external:alice:tokens",
            "state": [
                "cold_until",
                str(BUCKET),
                "cold:sum",
                "1",
                "epoch",
                "first",
                "revision",
                str(2**53 + 1),
            ],
        }
        await outpost.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": TIMESTAMP,
                "metadata": {"tokens": 3},
            }
        )
        await redis.publish("outpost:v1:0:updates", json.dumps(old))
        with anyio.fail_after(1):
            await received.wait()
        meter = await outpost.meter(external_customer_id="alice", meter_id="meter")
        assert meter is not None and meter.consumed_units == 13

        await redis.delete(key)
        await redis.hset(key, mapping={"cold_until": BUCKET, "cold:sum": 20})
        await outpost.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": TIMESTAMP,
                "metadata": {"tokens": 2},
            }
        )
        received = anyio.Event()
        await redis.publish("outpost:v1:0:updates", json.dumps(old))
        with anyio.fail_after(1):
            await received.wait()
        meter = await outpost.meter(external_customer_id="alice", meter_id="meter")
        assert meter is not None and meter.consumed_units == 22


@pytest.mark.anyio
async def test_bucket_updates_apply_in_order_and_reload_after_a_missed_revision(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:sum": 10})

    async def ingest(writer: Outpost, tokens: int) -> None:
        await writer.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": TIMESTAMP,
                "metadata": {"tokens": tokens},
            }
        )

    async def wait_for(reader: Outpost, consumed_units: int) -> None:
        with anyio.fail_after(1):
            while True:
                meter = await reader.meter(
                    external_customer_id="alice", meter_id="meter"
                )
                if meter is not None and meter.consumed_units == consumed_units:
                    return
                await anyio.lowlevel.checkpoint()

    async with (
        Outpost(url, client=polar_client) as writer,
        Outpost(url, client=polar_client) as reader,
    ):
        await reader.actor(external_customer_id="alice")
        await ingest(writer, 3)
        await wait_for(reader, 13)
        await redis.hset(key, "cold:sum", 20)
        await redis.hincrby(key, "revision", 1)
        await ingest(writer, 2)
        await wait_for(reader, 25)


@pytest.mark.anyio
async def test_background_refresh_repairs_missed_notification(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    monkeypatch.setattr("polar.outpost.client.SYNC_INTERVAL", 0.01)
    key = "outpost:v1:state:external:alice:tokens"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:sum": 1})
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await redis.hset(key, "cold:sum", 2)
        await redis.hincrby(key, "revision", 1)
        with anyio.fail_after(2):
            while True:
                meter = await outpost.meter(
                    external_customer_id="alice", meter_id="meter"
                )
                if meter is not None and meter.consumed_units == 2:
                    break
                await anyio.lowlevel.checkpoint()


@pytest.mark.anyio
async def test_pubsub_reconnect_reloads_state(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    original = PubSub.get_message
    disconnect = False

    async def get_message(
        self: PubSub, *args: typing.Any, **kwargs: typing.Any
    ) -> typing.Any:
        nonlocal disconnect
        if disconnect:
            disconnect = False
            raise RedisConnectionError("Subscription disconnected")
        return await original(self, *args, **kwargs)

    monkeypatch.setattr(PubSub, "get_message", get_message)
    key = "outpost:v1:state:external:alice:tokens"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:sum": 1})
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        disconnect = True
        await redis.hset(key, "cold:sum", 2)
        with anyio.fail_after(4):
            while outpost._synced.is_set():
                await anyio.lowlevel.checkpoint()
            while True:
                try:
                    meter = await outpost.meter(
                        external_customer_id="alice", meter_id="meter"
                    )
                    break
                except PolarOutpostError:
                    await anyio.sleep(0.05)
        assert meter is not None and meter.consumed_units == 2


@pytest.mark.anyio
async def test_evicted_customer_is_reloaded(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    monkeypatch.setattr("polar.outpost.client.CACHE_SIZE", 2)
    key = "outpost:v1:state:external:alice:tokens"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:sum": 1})
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await outpost.actor(external_customer_id="bob")
        await outpost.actor(external_customer_id="carol")
        await redis.hset(key, "cold:sum", 2)
        meter = await outpost.meter(external_customer_id="alice", meter_id="meter")
        assert meter is not None and meter.consumed_units == 2


@pytest.mark.anyio
async def test_websocket_connection_and_cleanup() -> None:
    messages: list[dict[str, typing.Any]] = []

    async def app(scope: typing.Any, receive: typing.Any, send: typing.Any) -> None:
        assert scope["path"] == "/v1/outpost/"
        assert (b"authorization", b"Bearer test-token") in scope["headers"]
        assert (b"polar-organization", b"org") in scope["headers"]
        assert (await receive())["type"] == "websocket.connect"
        await send({"type": "websocket.accept"})
        request = await receive()
        assert json.loads(request["text"]) == {"type": "ping"}
        await send(
            {
                "type": "websocket.send",
                "text": json.dumps(
                    {
                        "type": "configuration",
                        "payload": {"reducers": []},
                    }
                ),
            }
        )
        messages.append(await receive())

    async with httpx.AsyncClient(
        base_url="http://polar.test",
        transport=ASGIWebSocketTransport(app),
        headers={"Authorization": "Bearer test-token", "Polar-Organization": "org"},
    ) as client:
        async with connect_websocket(client) as websocket:
            await websocket.send_json({"type": "ping"})
            assert await websocket.receive_json() == {
                "type": "configuration",
                "payload": {"reducers": []},
            }
        assert not client.is_closed
    assert messages[0]["type"] == "websocket.disconnect"


@pytest.mark.anyio
async def test_independent_reducers_concurrent_statistics_and_meter_credits(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    configuration: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    configuration["reducers"][0]["meter_ids"].append("shared")
    configuration["reducers"] += [
        {
            "id": "average",
            "kind": "usage",
            "meter_ids": ["average-meter"],
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "avg", "property": "tokens"},
        },
        {
            **configuration["reducers"][1],
            "id": "shared-credits",
            "meter_ids": ["shared"],
        },
    ]
    apply_snapshot = redis.register_script(APPLY_SNAPSHOT_SCRIPT)

    async def seal(
        reducer_id: str, cutoff: int, version: int, *statistics: int
    ) -> None:
        identity = f"external:alice:{reducer_id}"
        await apply_snapshot(
            keys=[f"outpost:v1:state:{identity}"],
            args=[
                identity,
                "outpost:v1:0:updates",
                "epoch",
                cutoff,
                version,
                *statistics,
            ],
        )

    for reducer_id in ("tokens", "average"):
        await seal(reducer_id, BUCKET, 20, 2, 20, 5, 15)
    await seal("tokens", BUCKET, 19, 1, 999, 999, 999)
    await seal("credits", BUCKET, 20, 1, 100, 100, 100)
    await seal("shared-credits", BUCKET, 20, 1, 200, 200, 200)
    identity = "external:alice:tokens"
    async with (
        Outpost(url, client=polar_client) as first,
        Outpost(url, client=polar_client) as second,
    ):
        await first.actor(external_customer_id="alice")
        await second.actor(external_customer_id="alice")

        events: list[EventInput] = []

        async def emit(writer: Outpost, value: int) -> None:
            for _ in range(10):
                event = _usage(f"event-{next(_ids)}", value)
                events.append(event)
                await writer.track(event)

        async with anyio.create_task_group() as tasks:
            tasks.start_soon(emit, first, 2)
            tasks.start_soon(emit, second, 8)
        await first._refresh_states()
        meter = await first.meter(external_customer_id="alice", meter_id="meter")
        shared = await first.meter(external_customer_id="alice", meter_id="shared")
        average = await first.meter(
            external_customer_id="alice", meter_id="average-meter"
        )
        assert (
            meter is not None
            and meter.consumed_units == 120
            and meter.credited_units == 100
        )
        assert (
            shared is not None
            and shared.consumed_units == 120
            and shared.credited_units == 200
        )
        assert average is not None and average.consumed_units == pytest.approx(120 / 22)
        state = first._cache["external:alice:tokens"].state
        assert state is not None
        assert dataclasses.asdict(state.buckets[BUCKET]) == {
            "count": 20,
            "sum": 100,
            "min": 2,
            "max": 8,
        }
        await first.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": "2026-10-12T12:05:00Z",
                "metadata": {"tokens": 4},
            }
        )
        await first.confirm(events)
        await seal("tokens", BUCKET + BUCKET_SIZE, 21, 22, 120, 2, 15)
        await seal("credits", BUCKET + BUCKET_SIZE, 21, 2, 150, 50, 100)
        await first._refresh_states()
        # Every event in the bucket is confirmed: Polar counts it, the local copy is gone.
        assert (
            await redis.hget(f"outpost:v1:state:{identity}", f"bucket:{BUCKET}:sum")
            is None
        )
        assert (
            await redis.hget(
                "outpost:v1:state:external:alice:average", f"bucket:{BUCKET}:sum"
            )
            == b"100"
        )
        meter = await first.meter(external_customer_id="alice", meter_id="meter")
        average = await first.meter(
            external_customer_id="alice", meter_id="average-meter"
        )
        shared = await first.meter(external_customer_id="alice", meter_id="shared")
        assert meter is not None and meter.consumed_units == 124 and meter.balance == 26
        assert average is not None and average.consumed_units == pytest.approx(124 / 23)
        assert shared is not None and shared.credited_units == 200
        assert await redis.exists("outpost:v1:state:customer:alice:tokens") == 0


# Polar seals a bucket with what it has ingested so far; the local events it has not received
# yet stay counted as pending until Polar confirms them (PLR-329).
async def _seal(redis: Redis, cutoff: int, count: int = 0, total: int = 0) -> None:
    identity = "external:alice:tokens"
    await redis.register_script(APPLY_SNAPSHOT_SCRIPT)(
        keys=[f"outpost:v1:state:{identity}"],
        args=[
            identity,
            "outpost:v1:0:updates",
            "epoch",
            cutoff,
            cutoff + 1,
            count,
            total,
            "",
            "",
        ],
    )
    await _credit(redis, 100)


def _usage(external_id: str, tokens: int) -> EventInput:
    return {
        "name": "call",
        "external_customer_id": "alice",
        "external_id": external_id,
        "timestamp": TIMESTAMP,
        "metadata": {"tokens": tokens},
    }


async def _consumed(outpost: Outpost) -> int | float:
    meter = await outpost.meter(external_customer_id="alice", meter_id="meter")
    assert meter is not None
    return meter.consumed_units


@pytest.mark.anyio
async def test_keeps_local_events_when_bucket_goes_cold(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        for index in range(10):
            await outpost.track(_usage(f"event-{index}", 10))
        assert await _consumed(outpost) == 100
        await _seal(redis, BUCKET + BUCKET_SIZE)
        await outpost._refresh_states()
        assert await _consumed(outpost) == 100


@pytest.mark.anyio
async def test_counts_a_late_write_into_a_cold_bucket(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await _seal(redis, BUCKET + BUCKET_SIZE)
        await outpost._refresh_states()
        await outpost.track(_usage("late", 5))
        assert await _consumed(outpost) == 5


@pytest.mark.anyio
async def test_confirms_ingested_events_and_keeps_the_rest_pending(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        events = [_usage(f"event-{index}", 10) for index in range(10)]
        for event in events:
            await outpost.track(event)
        await outpost.confirm(events[:4])
        await _seal(redis, BUCKET + BUCKET_SIZE, 4, 40)
        await outpost._refresh_states()
        assert await _consumed(outpost) == 100
    assert await redis.hget(key, f"bucket:{BUCKET}:count") == b"10"
    assert await redis.hget(key, f"pending:{BUCKET}:count") == b"6"


@pytest.mark.anyio
async def test_keeps_the_pending_extrema_of_the_events_still_pending(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    configuration: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    configuration["reducers"][0]["aggregation"] = {"func": "max", "property": "tokens"}
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        events = [_usage("low", 3), _usage("high", 9), _usage("mid", 5)]
        for event in events:
            await outpost.track(event)
        assert await redis.hget(key, f"pending:{BUCKET}:min") == b"3"
        assert await redis.hget(key, f"pending:{BUCKET}:max") == b"9"
        await outpost.confirm([events[1], events[0]])
    assert await redis.hget(key, f"pending:{BUCKET}:min") == b"5"
    assert await redis.hget(key, f"pending:{BUCKET}:max") == b"5"
    assert await redis.hget(key, f"pending:{BUCKET}:count") == b"1"


@pytest.mark.anyio
async def test_settles_an_event_once_however_many_times_a_confirmation_names_it(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        events = [_usage("event-0", 10), _usage("event-1", 10)]
        for event in events:
            await outpost.track(event)
        await outpost.confirm([events[0], events[0]])
    assert await redis.hget(key, f"pending:{BUCKET}:count") == b"1"
    assert await redis.hget(key, f"pending:{BUCKET}:sum") == b"10"


@pytest.mark.anyio
async def test_settles_an_event_the_previous_sdk_version_left_pending(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await outpost.track(_usage("new", 10))
        # What WRITE_BUCKET used to store per event: count, sum, min and max, as strings.
        await redis.hset(
            f"outpost:v1:pending:external:alice:tokens:{BUCKET}",
            "old",
            '["1","7","7","7"]',
        )
        await redis.hincrby(key, f"pending:{BUCKET}:count", 1)
        await redis.hincrbyfloat(key, f"pending:{BUCKET}:sum", 7)
        await outpost.confirm([_usage("old", 7)])
    assert await redis.hget(key, f"pending:{BUCKET}:count") == b"1"
    assert await redis.hget(key, f"pending:{BUCKET}:sum") == b"10"


@pytest.mark.anyio
async def test_settles_a_hot_buckets_events_on_polars_receipt(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        events = [_usage("event-0", 10), _usage("event-1", 10)]
        for event in events:
            await outpost.track(event)
        await outpost.acknowledge(events)
        assert await _consumed(outpost) == 20
    assert await redis.hget(key, f"pending:{BUCKET}:count") is None
    assert await redis.hget(key, f"bucket:{BUCKET}:count") == b"2"


@pytest.mark.anyio
async def test_keeps_a_cold_buckets_events_pending_on_polars_receipt(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        events = [_usage("event-0", 10), _usage("event-1", 10)]
        for event in events:
            await outpost.track(event)
        await _seal(redis, BUCKET + BUCKET_SIZE)
        # Received is not counted: the snapshot that sealed the bucket did not have them.
        await outpost.acknowledge(events)
        assert await redis.hget(key, f"pending:{BUCKET}:count") == b"2"
        await outpost._refresh_states()
        assert await _consumed(outpost) == 20
        await outpost.confirm(events)
        assert await redis.hget(key, f"pending:{BUCKET}:count") is None
        assert await _consumed(outpost) == 0


@pytest.mark.anyio
async def test_ignores_a_duplicate_external_id(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await outpost.track(_usage("same", 10))
        await outpost.track(_usage("same", 10))
        assert await _consumed(outpost) == 10
    assert await redis.hget(key, f"pending:{BUCKET}:count") == b"1"


@pytest.mark.anyio
async def test_drops_a_cold_bucket_once_every_event_is_confirmed(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        events = [_usage("event-1", 10), _usage("event-2", 10)]
        for event in events:
            await outpost.track(event)
        await outpost.confirm(events)
        await _seal(redis, BUCKET + BUCKET_SIZE, 2, 20)
        await outpost._refresh_states()
        assert await _consumed(outpost) == 20
    assert await redis.hget(key, f"bucket:{BUCKET}:sum") is None
    assert await redis.hget(key, f"pending:{BUCKET}:sum") is None


# Before applying a snapshot that seals a bucket, the client asks Polar which of the bucket's
# pending events the snapshot counts, and settles those in the same transaction (PLR-330).
def _sealing(count: int, total: int) -> dict[str, typing.Any]:
    return {
        "customer_id": None,
        "external_customer_id": "alice",
        "cold_until": BUCKET + BUCKET_SIZE,
        "version": 1791807000000005,
        "count": count,
        "sum": total,
        "min": 10 if count else None,
        "max": 10 if count else None,
    }


async def _pending_count(redis: Redis) -> bytes | str | None:
    return await redis.hget(
        "outpost:v1:state:external:alice:tokens", f"pending:{BUCKET}:count"
    )


async def _wait_for(
    condition: collections.abc.Callable[[], typing.Awaitable[bool]],
) -> None:
    with anyio.fail_after(2):
        while not await condition():
            await anyio.sleep(0.01)


@pytest.mark.anyio
async def test_settles_the_pending_events_the_snapshot_counts(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    websocket_requests: list[dict[str, typing.Any]],
    ingested: set[str],
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        events = [_usage(f"event-{index}", 10) for index in range(10)]
        for event in events:
            await outpost.track(event)
        ingested.update(["event-0", "event-1", "event-2", "event-3"])
        snapshots["external:alice:tokens"] = _sealing(4, 40)
        async with Outpost(url, client=polar_client) as other:
            await other.actor(external_customer_id="alice")

            async def six_pending() -> bool:
                return await _pending_count(redis) == b"6"

            await _wait_for(six_pending)
            assert await _consumed(other) == 100
    assert await redis.hget(key, "cold:count") == b"4"
    assert [
        request for request in websocket_requests if request["type"] == "confirm"
    ] == [
        {
            "type": "confirm",
            "payload": {
                "reducer_id": "tokens",
                "external_customer_id": "alice",
                "bucket_start": BUCKET,
                "ids": [event["external_id"] for event in events],
            },
        }
    ]


@pytest.mark.anyio
async def test_applies_the_snapshot_polar_read_with_its_confirmation(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    ingested: set[str],
    confirmations: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        for index in range(10):
            await outpost.track(_usage(f"event-{index}", 10))
        snapshots["external:alice:tokens"] = _sealing(4, 40)
        # Polar stored one more event by the time it answers: both its snapshot and the
        # confirmation count it.
        ingested.update(f"event-{index}" for index in range(5))
        confirmations["snapshot"] = {**_sealing(5, 50), "version": 1791807000000006}
        async with Outpost(url, client=polar_client) as other:
            await other.actor(external_customer_id="alice")

            async def five_pending() -> bool:
                return await _pending_count(redis) == b"5"

            await _wait_for(five_pending)
            assert await _consumed(other) == 100
    assert await redis.hget(key, "cold:count") == b"5"
    assert await redis.hget(key, "snapshot_version") == b"1791807000000006"


@pytest.mark.anyio
async def test_drops_a_cold_bucket_once_polar_confirmed_every_pending_event(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    ingested: set[str],
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        for index in range(3):
            await outpost.track(_usage(f"event-{index}", 10))
        ingested.update(f"event-{index}" for index in range(3))
        snapshots["external:alice:tokens"] = _sealing(3, 30)
        async with Outpost(url, client=polar_client) as other:
            await other.actor(external_customer_id="alice")

            async def bucket_dropped() -> bool:
                return await redis.hget(key, f"bucket:{BUCKET}:sum") is None

            await _wait_for(bucket_dropped)
            assert await _consumed(other) == 30
    assert await redis.hget(key, f"pending:{BUCKET}:sum") is None


@pytest.mark.anyio
async def test_confirms_once_per_reducer_whatever_its_meters(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    configuration: dict[str, typing.Any],
    snapshots: dict[str, dict[str, typing.Any]],
    websocket_requests: list[dict[str, typing.Any]],
    ingested: set[str],
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    configuration["reducers"][0]["meter_ids"] = ["meter", "other"]
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        for index in range(2):
            await outpost.track(_usage(f"event-{index}", 10))
        ingested.update(f"event-{index}" for index in range(2))
        snapshots["external:alice:tokens"] = _sealing(2, 20)
        async with Outpost(url, client=polar_client) as other:
            await other.actor(external_customer_id="alice")

            async def sealed() -> bool:
                return await redis.hget(key, "cold:count") == b"2"

            await _wait_for(sealed)
    requested = {
        kind: [
            request["payload"]["reducer_id"]
            for request in websocket_requests
            if request["type"] == kind
        ]
        for kind in ("meter_usage", "confirm")
    }
    assert requested == {
        "meter_usage": ["tokens", "credits", "tokens", "credits"],
        "confirm": ["tokens"],
    }


@pytest.mark.anyio
async def test_applies_a_snapshot_polar_did_not_confirm_in_time(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    websocket_requests: list[dict[str, typing.Any]],
    confirmations: dict[str, bool],
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        for index in range(3):
            await outpost.track(_usage(f"event-{index}", 10))
        confirmations["answer"] = False
        snapshots["external:alice:tokens"] = _sealing(3, 30)
        async with Outpost(url, client=polar_client, confirm_timeout=0.05) as other:
            await other.actor(external_customer_id="alice")

            # The read moves once the snapshot applied and reached the cache: Polar's 30 plus
            # the 30 pending.
            async def sealed() -> bool:
                return await _consumed(other) == 60

            await _wait_for(sealed)
    assert sum(request["type"] == "confirm" for request in websocket_requests) == 1
    assert await redis.hget(key, "cold:count") == b"3"
    assert await _pending_count(redis) == b"3"


@pytest.mark.anyio
async def test_asks_for_pending_events_a_thousand_at_a_time(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    websocket_requests: list[dict[str, typing.Any]],
) -> None:
    url, redis = redis_connection
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        for index in range(1001):
            await outpost.track(_usage(f"event-{index}", 1))
        snapshots["external:alice:tokens"] = _sealing(0, 0)
        async with Outpost(url, client=polar_client) as other:
            await other.actor(external_customer_id="alice")

            async def two_requests() -> bool:
                return (
                    sum(request["type"] == "confirm" for request in websocket_requests)
                    == 2
                )

            await _wait_for(two_requests)
    assert [
        len(request["payload"]["ids"])
        for request in websocket_requests
        if request["type"] == "confirm"
    ] == [1000, 1]


@pytest.mark.anyio
async def test_forgets_pending_events_an_hour_after_their_bucket_was_sealed(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    await _seal(redis, BUCKET)
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await outpost.track(_usage("lost", 10))
        await _seal(redis, BUCKET + BUCKET_SIZE + 3_600_000_000)
        await outpost._refresh_states()
        assert await _consumed(outpost) == 0
    assert await redis.hget(key, f"bucket:{BUCKET}:sum") is None


@pytest.mark.anyio
async def test_cutoff_keeps_microsecond_precision(
    redis_connection: tuple[str, Redis],
) -> None:
    _, redis = redis_connection
    identity = "external:alice:tokens"
    key = f"outpost:v1:state:{identity}"
    prefix = [identity, "outpost:v1:0:updates", "epoch"]
    write = redis.register_script(WRITE_BUCKET_SCRIPT)
    snapshot = redis.register_script(APPLY_SNAPSHOT_SCRIPT)

    async def track(bucket_start: int, tokens: int, external_id: str) -> None:
        pending_key = f"outpost:v1:pending:{identity}:{bucket_start}"
        await write(
            keys=[key, pending_key],
            args=[*prefix, bucket_start, 1, tokens, tokens, tokens, external_id],
        )

    await track(BUCKET, 2, "first")
    await track(BUCKET + BUCKET_SIZE, 4, "second")
    await snapshot(
        keys=[key],
        args=[
            *prefix,
            BUCKET + 1,
            1791806400000001,
            1,
            2,
            2,
            2,
        ],
    )
    assert await redis.hget(key, "cold_until") == str(BUCKET + 1).encode()
    assert await redis.hget(key, f"bucket:{BUCKET}:sum") == b"2"
    assert await redis.hget(key, f"bucket:{BUCKET + BUCKET_SIZE}:sum") == b"4"
    await track(BUCKET, 999, "late")
    assert await redis.hget(key, f"bucket:{BUCKET}:sum") == b"1001"


@pytest.mark.anyio
async def test_telemetry_spans(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    exported_spans: list[ReadableSpan],
    exported_metrics: list[MetricsData],
) -> None:
    url, _ = redis_connection
    snapshots["external:alice:tokens"] = {
        "customer_id": None,
        "external_customer_id": "alice",
        "version": 1791807000000000,
        "cold_until": 1791806700000000,
        "count": 0,
        "sum": 0,
        "min": None,
        "max": None,
    }
    snapshots["external:alice:credits"] = ALICE_CREDITS
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "metadata": {"tokens": 3},
            }
        )
        with anyio.fail_after(1):
            while (
                "outpost.snapshot.received"
                not in {span.name for span in exported_spans}
                or outpost._sync_received == 0
            ):
                await anyio.lowlevel.checkpoint()
        await outpost.meter(meter_id="meter", external_customer_id="alice")

    buckets = _data_points(exported_metrics, "outpost.ingest.buckets")
    assert [point.value for point in buckets] == [1]
    durations = _data_points(exported_metrics, "outpost.ingest.duration")
    assert [(point.attributes, point.count) for point in durations] == [
        ({"outpost.outcome": "ok"}, 1)
    ]
    assert all(isinstance(point, ExponentialHistogramDataPoint) for point in durations)
    reads = _data_points(exported_metrics, "outpost.read.duration")
    assert [(point.attributes, point.count) for point in reads] == [
        ({"outpost.read.operation": "meter", "outpost.read.outcome": "ready"}, 1)
    ]
    assert all(isinstance(point, ExponentialHistogramDataPoint) for point in reads)
    names = {span.name for span in exported_spans}
    assert names == {
        "outpost.redis.connect",
        "outpost.redis.subscribe",
        "outpost.websocket.connect",
        "outpost.snapshot.received",
        "outpost.sync",
        "outpost.websocket.disconnect",
        "outpost.redis.disconnect",
    }
    connected = [
        span
        for span in exported_spans
        if span.name
        not in {
            "outpost.redis.connect",
            "outpost.redis.subscribe",
            "outpost.websocket.connect",
        }
    ]
    assert all(
        span.attributes is not None
        and span.attributes["outpost.connection_id"] == CONNECTION_ID
        for span in connected
    )
    resource = exported_spans[0].resource.attributes
    assert resource["service.name"] == "outpost"
    assert resource["service.version"] == __version__


@pytest.mark.anyio
async def test_flush_telemetry_reports_sync_counts(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_spans: list[ReadableSpan],
) -> None:
    url, _ = redis_connection
    async with (
        Outpost(url, client=polar_client) as writer,
        Outpost(url, client=polar_client) as reader,
    ):
        await reader.actor(external_customer_id="alice")
        events: list[EventInput] = [
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "metadata": {"tokens": 1},
            },
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "bob",
                "metadata": {"tokens": 1},
            },
        ]
        for event in events:
            await writer.track(event)
        with anyio.fail_after(1):
            while reader._sync_received < 2:
                await anyio.lowlevel.checkpoint()
        exported_spans.clear()
        await reader.flush_telemetry()
        await reader.flush_telemetry()
        assert [
            span.attributes for span in exported_spans if span.name == "outpost.sync"
        ] == [
            {
                "outpost.connection_id": CONNECTION_ID,
                "outpost.sync.received": 2,
                "outpost.sync.applied": 1,
            }
        ]


@pytest.mark.anyio
async def test_sync_report_does_not_split_a_message_in_flight(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_spans: list[ReadableSpan],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, _ = redis_connection
    async with (
        Outpost(url, client=polar_client) as writer,
        Outpost(url, client=polar_client) as reader,
    ):
        receiving = anyio.Event()
        release = anyio.Event()

        async def receive_state(
            customer: str, state: ReducerState, *, bucket: bool = False
        ) -> bool:
            receiving.set()
            await release.wait()
            return True

        monkeypatch.setattr(reader, "_receive_state", receive_state)
        await writer.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "metadata": {"tokens": 1},
            }
        )
        with anyio.fail_after(1):
            await receiving.wait()
        await reader.flush_telemetry()
        release.set()
        with anyio.fail_after(1):
            while reader._sync_applied == 0:
                await anyio.lowlevel.checkpoint()
        exported_spans.clear()
        await reader.flush_telemetry()
        assert [
            span.attributes for span in exported_spans if span.name == "outpost.sync"
        ] == [
            {
                "outpost.connection_id": CONNECTION_ID,
                "outpost.sync.received": 1,
                "outpost.sync.applied": 1,
            }
        ]


@pytest.mark.anyio
async def test_sync_counts_are_reported_periodically(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_spans: list[ReadableSpan],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("polar.outpost.client.SYNC_INTERVAL", 0.05)
    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "metadata": {"tokens": 1},
            }
        )
        # The listener checks the interval between one-second message polls.
        with anyio.fail_after(3):
            while "outpost.sync" not in {span.name for span in exported_spans}:
                await anyio.sleep(0.01)


@pytest.mark.anyio
@pytest.mark.parametrize(("telemetry", "environment"), [(False, None), (True, "0")])
async def test_telemetry_opt_out(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_spans: list[ReadableSpan],
    monkeypatch: pytest.MonkeyPatch,
    telemetry: bool,
    environment: str | None,
) -> None:
    if environment is not None:
        monkeypatch.setenv(TELEMETRY_ENV, environment)
    url, _ = redis_connection
    async with Outpost(url, client=polar_client, telemetry=telemetry) as outpost:
        await outpost.track(
            {"name": "call", "external_customer_id": "alice", "external_id": "event"}
        )
        await outpost.flush_telemetry()
    assert exported_spans == []


@pytest.mark.anyio
async def test_flush_telemetry_exports_buffered_spans(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_spans: list[ReadableSpan],
    exported_metrics: list[MetricsData],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "polar.outpost.telemetry.BatchSpanProcessor", BatchSpanProcessor
    )
    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.track(
            {"name": "call", "external_customer_id": "alice", "external_id": "event"}
        )
        assert exported_spans == []
        assert exported_metrics == []
        assert await outpost.flush_telemetry()
        assert "outpost.redis.connect" in {span.name for span in exported_spans}
        assert _data_points(exported_metrics, "outpost.ingest.duration") != []


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("snapshot_sum", "snapshot_max", "delta"), [(8, 5, False), (9, 6, True)]
)
async def test_snapshot_reports_local_value(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    exported_spans: list[ReadableSpan],
    snapshot_sum: int,
    snapshot_max: int,
    delta: bool,
) -> None:
    url, redis = redis_connection
    await redis.hset(
        "outpost:v1:state:external:alice:tokens",
        mapping={
            "cold_until": BUCKET - BUCKET_SIZE,
            "cold:count": 1,
            "cold:sum": 5,
            "cold:min": 5,
            "cold:max": 5,
            f"bucket:{BUCKET - BUCKET_SIZE}:count": 1,
            f"bucket:{BUCKET - BUCKET_SIZE}:sum": 3,
            f"bucket:{BUCKET - BUCKET_SIZE}:min": 3,
            f"bucket:{BUCKET - BUCKET_SIZE}:max": 3,
        },
    )
    snapshots["external:alice:tokens"] = {
        "customer_id": None,
        "external_customer_id": "alice",
        "version": 1791807000000000,
        "cold_until": BUCKET,
        "count": 2,
        "sum": snapshot_sum,
        "min": 3,
        "max": snapshot_max,
    }
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        with anyio.fail_after(1):
            while not any(
                span.name == "outpost.snapshot.received" for span in exported_spans
            ):
                await anyio.lowlevel.checkpoint()

    [span] = [
        span for span in exported_spans if span.name == "outpost.snapshot.received"
    ]
    assert span.attributes is not None
    assert span.attributes["outpost.customer"] == "external:alice"
    assert span.attributes["outpost.local.cold_until"] == BUCKET - BUCKET_SIZE
    assert span.attributes["outpost.local.count"] == 2
    assert span.attributes["outpost.local.sum"] == 8
    assert span.attributes["outpost.local.min"] == 3
    assert span.attributes["outpost.local.max"] == 5
    assert span.attributes["outpost.snapshot.sum"] == snapshot_sum
    assert span.attributes["outpost.snapshot.delta"] is delta


@pytest.mark.anyio
async def test_snapshot_reports_a_cold_bucket_by_its_pending_part(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    exported_spans: list[ReadableSpan],
) -> None:
    url, redis = redis_connection
    cold = BUCKET - 2 * BUCKET_SIZE
    await redis.hset(
        "outpost:v1:state:external:alice:tokens",
        mapping={
            "cold_until": BUCKET - BUCKET_SIZE,
            "cold:count": 1,
            "cold:sum": 5,
            "cold:min": 5,
            "cold:max": 5,
            # Already cold, kept for one unconfirmed event: the local read adds that event only.
            f"bucket:{cold}:count": 3,
            f"bucket:{cold}:sum": 9,
            f"bucket:{cold}:min": 2,
            f"bucket:{cold}:max": 4,
            f"pending:{cold}:count": 1,
            f"pending:{cold}:sum": 2,
            f"pending:{cold}:min": 2,
            f"pending:{cold}:max": 2,
            f"bucket:{BUCKET - BUCKET_SIZE}:count": 1,
            f"bucket:{BUCKET - BUCKET_SIZE}:sum": 3,
            f"bucket:{BUCKET - BUCKET_SIZE}:min": 3,
            f"bucket:{BUCKET - BUCKET_SIZE}:max": 3,
        },
    )
    snapshots["external:alice:tokens"] = {
        "customer_id": None,
        "external_customer_id": "alice",
        "version": 1791807000000000,
        "cold_until": BUCKET,
        "count": 3,
        "sum": 10,
        "min": 2,
        "max": 5,
    }
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        with anyio.fail_after(1):
            while not any(
                span.name == "outpost.snapshot.received" for span in exported_spans
            ):
                await anyio.lowlevel.checkpoint()

    [span] = [
        span for span in exported_spans if span.name == "outpost.snapshot.received"
    ]
    assert span.attributes is not None
    assert span.attributes["outpost.local.cold_until"] == BUCKET - BUCKET_SIZE
    assert span.attributes["outpost.local.count"] == 3
    assert span.attributes["outpost.local.sum"] == 10
    assert span.attributes["outpost.local.min"] == 2
    assert span.attributes["outpost.local.max"] == 5
    assert span.attributes["outpost.snapshot.delta"] is False


@pytest.mark.anyio
async def test_snapshot_reports_the_local_value_before_confirmed_events_settled(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    ingested: set[str],
    exported_spans: list[ReadableSpan],
) -> None:
    url, redis = redis_connection
    await _seal(redis, BUCKET)

    def confirming() -> list[ReadableSpan]:
        return [
            span
            for span in exported_spans
            if span.name == "outpost.snapshot.received"
            and span.attributes is not None
            and "outpost.pending.asked" in span.attributes
        ]

    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        for index in range(2):
            await outpost.track(_usage(f"event-{index}", 10))
        await _seal(redis, BUCKET + BUCKET_SIZE)
        ingested.update(f"event-{index}" for index in range(2))
        snapshots["external:alice:tokens"] = {
            **_sealing(2, 20),
            "cold_until": BUCKET + 2 * BUCKET_SIZE,
            "version": 1791807000000006,
        }
        async with Outpost(url, client=polar_client) as other:
            await other.actor(external_customer_id="alice")
            with anyio.fail_after(1):
                while not confirming():
                    await anyio.lowlevel.checkpoint()

    span = confirming()[0]
    assert span.attributes is not None
    assert span.attributes["outpost.local.cold_until"] == BUCKET + BUCKET_SIZE
    assert span.attributes["outpost.local.count"] == 2
    assert span.attributes["outpost.local.sum"] == 20
    assert span.attributes["outpost.pending.confirmed"] == 2
    assert span.attributes["outpost.snapshot.delta"] is False


@pytest.mark.anyio
async def test_state_lives_a_day_refreshed_by_reads_writes_and_confirmations(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
) -> None:
    url, redis = redis_connection
    snapshots["external:alice:tokens"] = ALICE_SNAPSHOT
    snapshots["external:alice:credits"] = ALICE_CREDITS
    key = "outpost:v1:state:external:alice:tokens"
    written = datetime.datetime.fromisoformat("2026-10-12T12:10:00Z")
    event: EventInput = {
        "name": "call",
        "external_id": f"event-{next(_ids)}",
        "external_customer_id": "alice",
        "timestamp": written.isoformat(),
        "metadata": {"tokens": 3},
    }
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        meter = await outpost.meter(meter_id="meter", external_customer_id="alice")
        assert meter is not None and meter.balance == 7
        assert 0 < await redis.ttl(key) <= 86_400
        await redis.expire(key, 60)
        await outpost.track(event)
        assert await redis.ttl(key) > 60
        pending = (
            f"outpost:v1:pending:external:alice:tokens:{get_bucket_start(written)}"
        )
        assert 0 < await redis.ttl(pending) <= 3_900
        await redis.expire(key, 60)
        await outpost.confirm([event])
        assert await redis.ttl(key) > 60


def reconnecting_client(
    connections: list[str], requests: list[dict[str, typing.Any]]
) -> httpx.AsyncClient:
    async def app(scope: typing.Any, receive: typing.Any, send: typing.Any) -> None:
        behavior = connections.pop(0)
        assert (await receive())["type"] == "websocket.connect"
        if behavior == "deny":
            await send(
                {"type": "websocket.http.response.start", "status": 401, "headers": []}
            )
            await send({"type": "websocket.http.response.body", "body": b""})
            return
        await send({"type": "websocket.accept"})
        await send(
            {
                "type": "websocket.send",
                "text": json.dumps({"type": "connection", "payload": {"id": behavior}}),
            }
        )
        while True:
            message = await receive()
            if message["type"] == "websocket.disconnect":
                return
            request = json.loads(message["text"])
            requests.append(request)
            if request["type"] == "configuration":
                await send(
                    {
                        "type": "websocket.send",
                        "text": json.dumps(
                            {"type": "configuration", "payload": CONFIGURATION}
                        ),
                    }
                )
                if behavior == "first":
                    await send({"type": "websocket.close", "code": 1012, "reason": ""})
                    return

    return httpx.AsyncClient(
        base_url="http://polar.test", transport=ASGIWebSocketTransport(app)
    )


@pytest.mark.anyio
async def test_websocket_reconnects_and_keeps_serving(
    redis_connection: tuple[str, Redis], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("polar.outpost.client.RECONNECT_DELAY", 0.01)
    url, _ = redis_connection
    requests: list[dict[str, typing.Any]] = []
    async with (
        reconnecting_client(["first", "second"], requests) as client,
        Outpost(url, client=client) as outpost,
    ):
        result = await outpost.track(
            {"name": "call", "external_customer_id": "alice", "external_id": "event"}
        )
        with anyio.fail_after(1):
            while outpost.connection_id != "second":
                await anyio.lowlevel.checkpoint()
        assert outpost.connected

    assert result is None
    assert [request["type"] for request in requests].count("configuration") == 2


@pytest.mark.anyio
async def test_refused_reconnection_fails_outpost(
    redis_connection: tuple[str, Redis], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("polar.outpost.client.RECONNECT_DELAY", 0.01)
    url, _ = redis_connection
    async with (
        reconnecting_client(["first", "deny"], []) as client,
        Outpost(url, client=client) as outpost,
    ):
        with anyio.fail_after(1):
            while True:
                try:
                    await outpost.actor(external_customer_id="alice")
                except PolarOutpostError:
                    break
                await anyio.sleep(0.01)
        assert not outpost.connected


@pytest.mark.parametrize("nested", [False, True])
@pytest.mark.parametrize(
    ("error", "retryable"),
    [
        (RedisConnectionError("Disconnected"), True),
        (RedisTimeoutError("DNS resolution timed out"), True),
        (AuthenticationError("Invalid credentials"), False),
        (AuthorizationError("Access denied"), False),
        (ValueError("Invalid snapshot"), False),
        (ResponseError("Invalid command"), False),
        (
            ExceptionGroup(
                "mixed", [RedisTimeoutError("Timeout"), ValueError("Invalid snapshot")]
            ),
            False,
        ),
    ],
)
def test_connection_errors(error: Exception, retryable: bool, nested: bool) -> None:
    if nested:
        error = ExceptionGroup("outer", [ExceptionGroup("inner", [error])])
    assert _is_connection_error(error) is retryable


@pytest.mark.anyio
@pytest.mark.parametrize("error_type", [RedisConnectionError, RedisTimeoutError])
async def test_snapshot_redis_error_reconnects_and_keeps_serving(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    websocket_requests: list[dict[str, typing.Any]],
    monkeypatch: pytest.MonkeyPatch,
    error_type: type[Exception],
) -> None:
    monkeypatch.setattr("polar.outpost.client.RECONNECT_DELAY", 0.01)
    url, redis = redis_connection
    snapshots["external:alice:tokens"] = ALICE_SNAPSHOT
    await _credit(redis, 10)
    async with Outpost(url, client=polar_client) as outpost:
        assert outpost._apply_snapshot is not None
        apply_snapshot = AsyncMock(
            wraps=outpost._apply_snapshot.__call__,
            side_effect=[error_type("DNS resolution timed out"), DEFAULT],
        )
        monkeypatch.setattr(outpost, "_apply_snapshot", apply_snapshot)
        await outpost.actor(external_customer_id="alice")
        with anyio.fail_after(1):
            while (
                sum(
                    request["type"] == "configuration" for request in websocket_requests
                )
                < 2
            ):
                await anyio.lowlevel.checkpoint()

        await outpost.actor(external_customer_id="alice")
        # Once reconnected, the snapshot can arrive after the test's short SNAPSHOT_TIMEOUT.
        with anyio.fail_after(1):
            while True:
                try:
                    meter = await outpost.meter(
                        meter_id="meter", external_customer_id="alice"
                    )
                    break
                except _NotReadyError:
                    pass
        assert meter is not None and meter.consumed_units == 3
        await outpost.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": "2026-10-12T12:10:00Z",
                "metadata": {"tokens": 5},
            }
        )
        meter = await outpost.meter(meter_id="meter", external_customer_id="alice")
        assert meter is not None and meter.consumed_units == 8
        assert meter.balance == 2
        assert outpost.connected
        assert apply_snapshot.await_count == 2


def test_backoff_delay_stays_bounded() -> None:
    assert 15 <= _backoff_delay(5000, 0.5, 30) <= 30


def test_redis_reconnect_backoff_stays_bounded() -> None:
    assert 1 <= RedisReconnectBackoff().compute(5000) <= 2


ALICE_SNAPSHOT: dict[str, typing.Any] = {
    "customer_id": None,
    "external_customer_id": "alice",
    "version": 1791807000000000,
    "cold_until": 1791806700000000,
    "count": 1,
    "sum": 3,
    "min": 3,
    "max": 3,
}
# Polar sends every unsealed credit: the snapshot covers everything up to its version.
ALICE_CREDITS: dict[str, typing.Any] = {
    **ALICE_SNAPSHOT,
    "cold_until": ALICE_SNAPSHOT["version"],
    "sum": 10,
    "min": 10,
    "max": 10,
}


def read_outcomes(exported: list[MetricsData]) -> list[tuple[str, typing.Any]]:
    return [
        (
            point.attributes["outpost.read.operation"],
            point.attributes["outpost.read.outcome"],
        )
        for point in _data_points(exported, "outpost.read.duration")
    ]


@pytest.mark.anyio
async def test_cold_read_waits_for_the_snapshot(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    exported_metrics: list[MetricsData],
) -> None:
    url, _ = redis_connection
    snapshots["external:alice:tokens"] = ALICE_SNAPSHOT
    snapshots["external:alice:credits"] = ALICE_CREDITS
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        meter = await outpost.meter(meter_id="meter", external_customer_id="alice")
    assert meter is not None
    assert meter.balance == 7
    assert read_outcomes(exported_metrics) == [
        ("actor", "ready"),
        ("meter", "ready"),
    ]


@pytest.mark.anyio
async def test_balance_is_the_credit_reducer_total_minus_usage(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
) -> None:
    url, _ = redis_connection
    snapshots["external:alice:tokens"] = ALICE_SNAPSHOT
    snapshots["external:alice:credits"] = {**ALICE_CREDITS, "count": 2, "sum": 50}
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await outpost.track(
            {
                "name": "call",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": "2026-10-12T12:10:00Z",
                "metadata": {"tokens": 4},
            }
        )
        meter = await outpost.meter(meter_id="meter", external_customer_id="alice")
    assert meter is not None
    assert (meter.consumed_units, meter.credited_units, meter.balance) == (7, 50, 43)


@pytest.mark.anyio
@pytest.mark.parametrize(("version_offset", "credited"), [(1, 25), (-1, 10)])
async def test_a_pushed_credit_snapshot_updates_the_balance_unless_older(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    polar_sends: list[typing.Any],
    exported_spans: list[ReadableSpan],
    version_offset: int,
    credited: int,
) -> None:
    url, _ = redis_connection
    snapshots["external:alice:tokens"] = ALICE_SNAPSHOT
    snapshots["external:alice:credits"] = ALICE_CREDITS
    version = ALICE_CREDITS["version"] + version_offset
    pushed = {
        **ALICE_CREDITS,
        "customer_exists": True,
        "reducer_id": "credits",
        "version": version,
        "cold_until": version,
        "sum": 25,
    }
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await polar_sends[-1](
            {
                "type": "websocket.send",
                "text": json.dumps({"type": "meter_usage", "payload": pushed}),
            }
        )
        with anyio.fail_after(1):
            while (
                sum(span.name == "outpost.snapshot.received" for span in exported_spans)
                < 3
            ):
                await anyio.lowlevel.checkpoint()
        meter = await outpost.meter(meter_id="meter", external_customer_id="alice")
    assert meter is not None
    assert meter.credited_units == credited
    assert meter.balance == credited - 3


@pytest.mark.anyio
async def test_meter_without_a_credit_reducer_reads_no_credits(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    configuration: dict[str, typing.Any],
    snapshots: dict[str, dict[str, typing.Any]],
    exported_metrics: list[MetricsData],
) -> None:
    url, _ = redis_connection
    del configuration["reducers"][1]
    snapshots["external:alice:tokens"] = ALICE_SNAPSHOT
    async with Outpost(url, client=polar_client) as outpost:
        meter = await outpost.meter(meter_id="meter", external_customer_id="alice")
    assert meter is not None
    assert (meter.credited_units, meter.balance) == (0, -3)
    assert read_outcomes(exported_metrics) == [("meter", "ready")]


@pytest.mark.anyio
async def test_local_events_never_land_in_a_credit_reducer(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    configuration: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    configuration["reducers"][1]["filter"] = {"conjunction": "and", "clauses": []}
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.track(
            {
                "name": "meter.credited",
                "external_id": f"event-{next(_ids)}",
                "external_customer_id": "alice",
                "timestamp": TIMESTAMP,
                "metadata": {"meter_id": "meter", "units": 5, "tokens": 5},
            }
        )
    assert (
        await redis.hget(
            "outpost:v1:state:external:alice:tokens", f"bucket:{BUCKET}:sum"
        )
        == b"5"
    )
    assert not await redis.hexists(
        "outpost:v1:state:external:alice:credits", f"bucket:{BUCKET}:count"
    )
    assert not await redis.exists(f"outpost:v1:pending:external:alice:credits:{BUCKET}")


@pytest.mark.anyio
async def test_unknown_meter_reads_none(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_metrics: list[MetricsData],
) -> None:
    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        assert (
            await outpost.meter(meter_id="other", external_customer_id="alice") is None
        )
    assert read_outcomes(exported_metrics) == [("meter", "unknown_meter")]


@pytest.mark.anyio
async def test_reads_without_configuration_are_not_ready(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_metrics: list[MetricsData],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Unconfigured:
        def set(self) -> None: ...

        def is_set(self) -> bool:
            return False

        async def wait(self) -> None:
            raise TimeoutError

    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        monkeypatch.setattr(outpost, "_configured", Unconfigured())
        with pytest.raises(TimeoutError):
            await outpost.actor(external_customer_id="alice")
        with pytest.raises(TimeoutError):
            await outpost.meter(meter_id="meter", external_customer_id="alice")
    assert read_outcomes(exported_metrics) == [
        ("actor", "not_ready"),
        ("meter", "not_ready"),
    ]


@pytest.mark.anyio
async def test_failed_read_is_an_error(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_metrics: list[MetricsData],
) -> None:
    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        outpost._failure = PolarOutpostError("Outpost stopped")
        with pytest.raises(PolarOutpostError, match="Outpost stopped"):
            await outpost.meter(meter_id="meter", external_customer_id="alice")
        outpost._failure = None
    assert read_outcomes(exported_metrics) == [("meter", "error")]


@pytest.mark.anyio
async def test_unknown_customer_reads_none(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    exported_metrics: list[MetricsData],
) -> None:
    url, _ = redis_connection
    snapshots["external:alice:tokens"] = {**ALICE_SNAPSHOT, "customer_exists": False}
    snapshots["external:alice:credits"] = {**ALICE_CREDITS, "customer_exists": False}
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        assert (
            await outpost.meter(meter_id="meter", external_customer_id="alice") is None
        )
    assert read_outcomes(exported_metrics) == [
        ("actor", "unknown_customer"),
        ("meter", "unknown_customer"),
    ]


@pytest.mark.anyio
async def test_missing_snapshot_times_out(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_metrics: list[MetricsData],
) -> None:
    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        with pytest.raises(PolarOutpostError, match="not ready"):
            await outpost.meter(meter_id="meter", external_customer_id="alice")
    assert read_outcomes(exported_metrics) == [
        ("actor", "not_ready"),
        ("meter", "not_ready"),
    ]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("delay", "credited", "outcome"), [(0.05, 200, "ready"), (0.5, 0, "not_ready")]
)
async def test_cold_read_waits_for_its_own_meter(
    redis_connection: tuple[str, Redis],
    exported_metrics: list[MetricsData],
    delay: float,
    credited: int,
    outcome: str,
) -> None:
    url, _ = redis_connection
    configuration = copy.deepcopy(CONFIGURATION)
    configuration["reducers"][0]["meter_ids"].append("shared")
    configuration["reducers"].append(
        {
            **configuration["reducers"][1],
            "id": "shared-credits",
            "meter_ids": ["shared"],
        }
    )
    credits = {"credits": 100, "shared-credits": 200}

    async def app(scope: typing.Any, receive: typing.Any, send: typing.Any) -> None:
        assert (await receive())["type"] == "websocket.connect"
        await send({"type": "websocket.accept"})
        while True:
            message = await receive()
            if message["type"] == "websocket.disconnect":
                return
            request = json.loads(message["text"])
            if request["type"] == "configuration":
                payload: typing.Any = configuration
            else:
                reducer_id = request["payload"]["reducer_id"]
                if reducer_id == "shared-credits":
                    await anyio.sleep(delay)
                snapshot = (
                    {**ALICE_CREDITS, "sum": credits[reducer_id]}
                    if reducer_id in credits
                    else ALICE_SNAPSHOT
                )
                payload = {
                    **snapshot,
                    "customer_exists": True,
                    "reducer_id": reducer_id,
                }
            await send(
                {
                    "type": "websocket.send",
                    "text": json.dumps({"type": request["type"], "payload": payload}),
                }
            )

    async with (
        httpx.AsyncClient(
            base_url="http://polar.test", transport=ASGIWebSocketTransport(app)
        ) as client,
        Outpost(url, client=client) as outpost,
    ):
        meter = await outpost.meter(meter_id="shared", external_customer_id="alice")
    assert meter is not None
    assert meter.credited_units == credited
    assert read_outcomes(exported_metrics) == [("meter", outcome)]


@pytest.mark.anyio
async def test_unknown_customer_reads_its_value_once_created(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
) -> None:
    url, _ = redis_connection
    snapshots["external:alice:tokens"] = {**ALICE_SNAPSHOT, "customer_exists": False}
    snapshots["external:alice:credits"] = {**ALICE_CREDITS, "customer_exists": False}
    async with Outpost(url, client=polar_client) as outpost:
        read = functools.partial(
            outpost.meter, meter_id="meter", external_customer_id="alice"
        )
        assert await read() is None
        snapshots["external:alice:tokens"] = ALICE_SNAPSHOT
        snapshots["external:alice:credits"] = ALICE_CREDITS
        with anyio.fail_after(1):
            while (meter := await read()) is None:
                await anyio.sleep(0.01)
    assert meter.balance == 7


@pytest.mark.anyio
async def test_redis_errors_raise_outpost_errors(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    exported_metrics: list[MetricsData],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("polar.outpost.client.REDIS_TIMEOUT", 0.2)
    url, redis = redis_connection
    server: FakeServer = redis.connection_pool.connection_kwargs["server"]
    snapshots["external:alice:tokens"] = ALICE_SNAPSHOT
    snapshots["external:alice:credits"] = ALICE_CREDITS
    async with Outpost(url, client=polar_client) as outpost:
        server.connected = False
        with pytest.raises(UnavailableRedisError):
            await outpost.meter(meter_id="meter", external_customer_id="alice")
        await outpost.flush_telemetry()
        assert read_outcomes(exported_metrics) == [("meter", "redis_unavailable")]
        with pytest.raises(UnavailableRedisError):
            await outpost.track(
                {
                    "name": "call",
                    "external_customer_id": "alice",
                    "external_id": "event",
                }
            )
        server.connected = True
        with anyio.fail_after(3):
            while True:
                try:
                    meter = await outpost.meter(
                        meter_id="meter", external_customer_id="alice"
                    )
                    break
                except PolarOutpostError:
                    await anyio.sleep(0.05)
    assert meter is not None
    assert meter.balance == 7


@pytest.mark.anyio
async def test_redis_unavailable_at_startup(
    redis_connection: tuple[str, Redis], polar_client: httpx.AsyncClient
) -> None:
    url, redis = redis_connection
    server: FakeServer = redis.connection_pool.connection_kwargs["server"]
    server.connected = False
    with pytest.raises(UnavailableRedisError):
        async with Outpost(url, client=polar_client):
            pass


@pytest.mark.anyio
async def test_redis_outage_fails_fast(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_metrics: list[MetricsData],
) -> None:
    url, redis = redis_connection
    server: FakeServer = redis.connection_pool.connection_kwargs["server"]
    async with Outpost(url, client=polar_client) as outpost:
        server.connected = False
        with anyio.fail_after(3):
            while outpost._synced.is_set():
                await anyio.sleep(0.01)
        assert not outpost.connected
        with anyio.fail_after(0.5):
            with pytest.raises(UnavailableRedisError):
                await outpost.meter(meter_id="meter", external_customer_id="bob")
    assert read_outcomes(exported_metrics) == [("meter", "redis_unavailable")]


@pytest.mark.anyio
async def test_failed_resync_wakes_waiting_reads(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, _ = redis_connection
    original = PubSub.get_message
    disconnect = False

    async def get_message(
        self: PubSub, *args: typing.Any, **kwargs: typing.Any
    ) -> typing.Any:
        nonlocal disconnect
        if disconnect:
            disconnect = False
            raise RedisConnectionError("Subscription disconnected")
        return await original(self, *args, **kwargs)

    monkeypatch.setattr(PubSub, "get_message", get_message)
    async with Outpost(url, client=polar_client) as outpost:
        gate = anyio.Event()

        async def refresh_states() -> None:
            await gate.wait()
            raise RedisConnectionError("Resync failed")

        monkeypatch.setattr(outpost, "_refresh_states", refresh_states)
        disconnect = True
        with anyio.fail_after(3):
            while outpost._synced.is_set() or not outpost._redis_available:
                await anyio.sleep(0.01)

        async def read() -> None:
            with pytest.raises(UnavailableRedisError):
                await outpost.meter(meter_id="meter", external_customer_id="bob")

        with anyio.fail_after(1):
            async with anyio.create_task_group() as tasks:
                tasks.start_soon(read)
                await anyio.sleep(0.05)
                gate.set()


@pytest.mark.parametrize("value", ["abc", "Infinity", "NaN", "1e999"])
def test_decode_state_rejects_unparsable_values(value: str) -> None:
    with pytest.raises(ValueError):
        decode_state(["epoch", "epoch", "revision", "1", "cold:sum", value])


# Fails the day a write stores a value that JSON and _number don't read the same way.
@pytest.mark.anyio
async def test_stored_values_parse_the_same_with_and_without_json(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
) -> None:
    url, redis = redis_connection
    key = "outpost:v1:state:external:alice:tokens"
    snapshots["external:alice:tokens"] = {
        "customer_id": None,
        "external_customer_id": "alice",
        "version": 1791807000000001,
        "cold_until": BUCKET,
        "count": 3,
        "sum": 0.30000000000000004,
        "min": -1e-7,
        "max": 1e21,
    }
    snapshots["external:alice:credits"] = {
        **snapshots["external:alice:tokens"],
        "cold_until": 1791807000000001,
        "sum": 2**53 + 2,
    }
    credits_key = "outpost:v1:state:external:alice:credits"
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        with anyio.fail_after(1):
            while not (
                await redis.hexists(key, "cold:sum")
                and await redis.hexists(credits_key, "cold:sum")
            ):
                await anyio.lowlevel.checkpoint()
        for tokens in (0, -0.0, 1, -2, 0.1, 0.2, 1e-7, 1e21, 2**53, -1.5e300):
            await outpost.track(
                {
                    "name": "call",
                    "external_id": f"event-{next(_ids)}",
                    "external_customer_id": "alice",
                    "timestamp": TIMESTAMP,
                    "metadata": {"tokens": tokens},
                }
            )
    for state_key in (key, credits_key):
        stored = await redis.hgetall(state_key)
        del stored[b"epoch"]
        for field, value in stored.items():
            assert isinstance(value, bytes)
            assert (field, _number(value.decode())) == (field, json.loads(value))
