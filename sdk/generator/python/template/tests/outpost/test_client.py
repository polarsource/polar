import collections.abc
import copy
import dataclasses
import datetime
import functools
import json
import typing

import anyio
import anyio.lowlevel
import httpx
import pytest
from fakeredis import FakeAsyncRedis, FakeServer
from httpx_ws.transport import ASGIWebSocketTransport
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    SimpleSpanProcessor,
    SpanExporter,
    SpanExportResult,
)
from redis.asyncio import Redis
from redis.asyncio.client import PubSub
from redis.exceptions import ConnectionError as RedisConnectionError

from polar import __version__
from polar.outpost import EventInput
from polar.outpost.client import (
    APPLY_SNAPSHOT_SCRIPT,
    WRITE_BUCKET_SCRIPT,
    Outpost,
    PolarOutpostError,
    ReducerState,
    _backoff_delay,
    connect_websocket,
)
from polar.outpost.reducer import BUCKET_SIZE, get_bucket_start
from polar.outpost.telemetry import TELEMETRY_ENV
from polar.{{ ir.versions[0] | format_version }}.inputs import EventsIngest

CONNECTION_ID = "5b6e1f0c-8f4c-4d2a-9a51-3c7d2e8b1f60"
TIMESTAMP = "2026-10-12T12:00:00Z"
BUCKET = get_bucket_start(datetime.datetime.fromisoformat(TIMESTAMP))
CONFIGURATION: dict[str, typing.Any] = {
    "reducers": [
        {
            "id": "tokens",
            "meter_ids": ["meter"],
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "sum", "property": "tokens"},
        }
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


@pytest.fixture
async def polar_client(
    configuration: dict[str, typing.Any],
    snapshots: dict[str, dict[str, typing.Any]],
    websocket_requests: list[dict[str, typing.Any]],
    configuration_gates: list[anyio.Event],
) -> collections.abc.AsyncIterator[httpx.AsyncClient]:
    async def app(scope: typing.Any, receive: typing.Any, send: typing.Any) -> None:
        assert (b"authorization", b"Bearer test-token") in scope["headers"]
        assert (await receive())["type"] == "websocket.connect"
        await send({"type": "websocket.accept"})
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
                snapshot = snapshots.get(f"{kind}:{identifier}")
                if snapshot is not None:
                    await send(
                        {
                            "type": "websocket.send",
                            "text": json.dumps(
                                {
                                    "type": "meter_usage",
                                    "payload": {"customer_exists": True, **snapshot},
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
async def test_ingest_accepts_raw_sdk_payload(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, redis = redis_connection
    request: EventsIngest = {
        "events": [
            {
                "name": "call",
                "external_customer_id": "alice",
                "timestamp": TIMESTAMP,
                "external_id": "event-1",
                "metadata": {"tokens": 3},
            },
            {
                "name": "call",
                "customer_id": "alice",
                "metadata": {"tokens": 5},
            },
        ]
    }
    async with Outpost(url, client=polar_client) as outpost:
        result = await outpost.ingest(**request)
    assert result.inserted == 2
    field = f"bucket:{BUCKET}:sum"
    assert await redis.hget("outpost:state:external:alice:tokens", field) == b"3"
    own = await redis.hgetall("outpost:state:customer:alice:tokens")
    assert any(
        isinstance(field, bytes)
        and field.startswith(b"bucket:")
        and field.endswith(b":sum")
        and value == b"5"
        for field, value in own.items()
    )


@pytest.mark.anyio
async def test_connection_id_is_retained_while_connected(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, _ = redis_connection
    outpost = Outpost(url, client=polar_client)
    async with outpost:
        await outpost.ingest(events=[{"name": "call", "external_customer_id": "alice"}])
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
        "outpost:state:external:alice:tokens",
        mapping={
            "cold_until": BUCKET,
            "cold:count": 2,
            "cold:sum": 2,
            "cold:min": 2,
            "cold:max": 2,
            "credited:meter": 20,
            f"bucket:{BUCKET - BUCKET_SIZE}:sum": 999,
        },
    )
    async with (
        Outpost(url, client=polar_client) as writer,
        Outpost(url, client=polar_client) as reader,
    ):
        await reader.actor(external_customer_id="alice")
        for value in (-2, 4):
            await writer.ingest(
                events=[
                    {
                        "name": "call",
                        "external_customer_id": "alice",
                        "timestamp": TIMESTAMP,
                        "metadata": {"tokens": value},
                    }
                ]
            )
        own_meter = await writer.customer_meter(
            external_customer_id="alice", meter_id="meter"
        )
        assert own_meter is not None and own_meter.consumed_units == expected
        with anyio.fail_after(1):
            while True:
                meter = await reader.customer_meter(
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
        "outpost:state:customer:alice:tokens",
        mapping={
            "cold_until": BUCKET,
            "cold:sum": 10,
            "credited:meter": 100,
        },
    )
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.ingest(
            events=[
                {
                    "name": "call",
                    "customer_id": "alice",
                    "timestamp": "2026-10-12T11:59:59Z",
                    "metadata": {"tokens": 999},
                },
                {
                    "name": "call",
                    "customer_id": "alice",
                    "timestamp": TIMESTAMP,
                    "metadata": {"tokens": 2},
                },
            ]
        )
        meter = await outpost.customer_meter(customer_id="alice", meter_id="meter")
    assert meter is not None
    assert meter.customer_id == "alice"
    assert meter.consumed_units == 12
    assert (
        await redis.hget(
            "outpost:state:customer:alice:tokens", f"bucket:{BUCKET - BUCKET_SIZE}:sum"
        )
        is None
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
            await outpost.customer_meter(
                external_customer_id="alice", meter_id="unknown"
            )
            is None
        )
        with pytest.raises(PolarOutpostError, match="snapshot is not ready"):
            await outpost.customer_meter(external_customer_id="alice", meter_id="meter")
    assert [
        message for message in websocket_requests if message["type"] == "meter_usage"
    ] == [
        {
            "type": "meter_usage",
            "payload": {"external_customer_id": "alice", "meter_id": "meter"},
        }
    ]


@pytest.mark.anyio
async def test_repeated_reduction_and_concurrent_writers(
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
            tasks.start_soon(functools.partial(outpost.ingest, events=[event]))
    assert (
        await redis.hget("outpost:state:external:alice:tokens", f"bucket:{BUCKET}:sum")
        == b"10"
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
        "external_customer_id": "alice",
        "timestamp": TIMESTAMP,
        "metadata": {"tokens": 3},
    }
    with anyio.fail_after(1):
        async with (
            Outpost(url, client=polar_client) as outpost,
            anyio.create_task_group() as tasks,
        ):
            tasks.start_soon(functools.partial(outpost.ingest, events=[event]))
            await anyio.lowlevel.checkpoint()
            assert not await redis.exists("outpost:state:external:alice:tokens")
            gate.set()
    assert (
        await redis.hget("outpost:state:external:alice:tokens", f"bucket:{BUCKET}:sum")
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
    key = "outpost:state:external:alice:tokens"
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
        snapshots["external:alice"] = {
            "customer_id": None,
            "external_customer_id": "alice",
            "meter_id": "meter",
            "version": 1791807000000000,
            "cold_until": 1791806700000000,
            "count": 2,
            "sum": 107,
            "min": 7,
            "max": 100,
            "credited_units": 200,
        }
        await owner.actor(external_customer_id="alice")
        with anyio.fail_after(1):
            while True:
                meter = await reader.customer_meter(
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
    key = "outpost:state:external:alice:tokens"
    prefix = ["external:alice:tokens", "outpost:0:updates", "epoch"]
    args = [*prefix, BUCKET, 20, "meter", 20, 1, 10, 10, 10]
    await apply_snapshot(keys=[key], args=args)
    await apply_snapshot(keys=[key], args=args)
    await apply_snapshot(
        keys=[key],
        args=[*prefix, BUCKET - BUCKET_SIZE, 30, "meter", 99, 1, 999, 999, 999],
    )
    await apply_snapshot(
        keys=[key],
        args=[*prefix, BUCKET, 19, "meter", 99, 1, 999, 999, 999],
    )
    assert await redis.hget(key, "cold:sum") == b"10"
    assert await redis.hget(key, "credited:meter") == b"20"
    await apply_snapshot(
        keys=[key], args=[*prefix, BUCKET, 21, "meter", 25, 0, 0, "", ""]
    )
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
        "outpost:state:external:alice:tokens",
        mapping={"cold_until": BUCKET, "cold:sum": 10},
    )
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.ingest(
            events=[
                {
                    "name": "call",
                    "external_customer_id": "alice",
                    "timestamp": TIMESTAMP,
                    "metadata": {"tokens": 3},
                }
            ]
        )

        async def unexpected_command(
            *args: typing.Any, **kwargs: typing.Any
        ) -> typing.Any:
            pytest.fail("A warmed meter read must not issue Redis commands")

        assert outpost._redis is not None
        monkeypatch.setattr(outpost._redis, "execute_command", unexpected_command)
        meter = await outpost.customer_meter(
            external_customer_id="alice", meter_id="meter"
        )
        assert meter is not None and meter.consumed_units == 13


@pytest.mark.anyio
async def test_old_messages_and_redis_reset_do_not_roll_back_cache(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    key = "outpost:state:external:alice:tokens"
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

        async def receive_state(customer: str, state: ReducerState) -> None:
            await original(customer, state)
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
        await outpost.ingest(
            events=[
                {
                    "name": "call",
                    "external_customer_id": "alice",
                    "timestamp": TIMESTAMP,
                    "metadata": {"tokens": 3},
                }
            ]
        )
        await redis.publish("outpost:0:updates", json.dumps(old))
        with anyio.fail_after(1):
            await received.wait()
        meter = await outpost.customer_meter(
            external_customer_id="alice", meter_id="meter"
        )
        assert meter is not None and meter.consumed_units == 13

        await redis.delete(key)
        await redis.hset(key, mapping={"cold_until": BUCKET, "cold:sum": 20})
        await outpost.ingest(
            events=[
                {
                    "name": "call",
                    "external_customer_id": "alice",
                    "timestamp": TIMESTAMP,
                    "metadata": {"tokens": 2},
                }
            ]
        )
        received = anyio.Event()
        await redis.publish("outpost:0:updates", json.dumps(old))
        with anyio.fail_after(1):
            await received.wait()
        meter = await outpost.customer_meter(
            external_customer_id="alice", meter_id="meter"
        )
        assert meter is not None and meter.consumed_units == 22


@pytest.mark.anyio
async def test_background_refresh_repairs_missed_notification(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    monkeypatch.setattr("polar.outpost.client.SYNC_INTERVAL", 0.01)
    key = "outpost:state:external:alice:tokens"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:sum": 1})
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await redis.hset(key, "cold:sum", 2)
        await redis.hincrby(key, "revision", 1)
        with anyio.fail_after(2):
            while True:
                meter = await outpost.customer_meter(
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
    key = "outpost:state:external:alice:tokens"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:sum": 1})
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        disconnect = True
        await redis.hset(key, "cold:sum", 2)
        with anyio.fail_after(4):
            while outpost._synced.is_set():
                await anyio.lowlevel.checkpoint()
            meter = await outpost.customer_meter(
                external_customer_id="alice", meter_id="meter"
            )
        assert meter is not None and meter.consumed_units == 2


@pytest.mark.anyio
async def test_evicted_customer_is_reloaded(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    monkeypatch.setattr("polar.outpost.client.CACHE_SIZE", 2)
    key = "outpost:state:external:alice:tokens"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:sum": 1})
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await outpost.actor(external_customer_id="bob")
        await outpost.actor(external_customer_id="carol")
        await redis.hset(key, "cold:sum", 2)
        meter = await outpost.customer_meter(
            external_customer_id="alice", meter_id="meter"
        )
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
    configuration["reducers"].append(
        {
            "id": "average",
            "meter_ids": ["average-meter"],
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "avg", "property": "tokens"},
        }
    )
    apply_snapshot = redis.register_script(APPLY_SNAPSHOT_SCRIPT)
    for reducer_id, meter_id in [("tokens", "meter"), ("average", "average-meter")]:
        identity = f"external:alice:{reducer_id}"
        await apply_snapshot(
            keys=[f"outpost:state:{identity}"],
            args=[
                identity,
                "outpost:0:updates",
                "epoch",
                BUCKET,
                20,
                meter_id,
                100,
                2,
                20,
                5,
                15,
            ],
        )
    identity = "external:alice:tokens"
    await apply_snapshot(
        keys=[f"outpost:state:{identity}"],
        args=[
            identity,
            "outpost:0:updates",
            "epoch",
            BUCKET,
            19,
            "shared",
            200,
            1,
            999,
            999,
            999,
        ],
    )
    async with (
        Outpost(url, client=polar_client) as first,
        Outpost(url, client=polar_client) as second,
    ):
        await first.actor(external_customer_id="alice")
        await second.actor(external_customer_id="alice")

        async def emit(writer: Outpost, value: int) -> None:
            for _ in range(10):
                await writer.ingest(
                    events=[
                        {
                            "name": "call",
                            "external_customer_id": "alice",
                            "timestamp": TIMESTAMP,
                            "metadata": {"tokens": value},
                        }
                    ]
                )

        async with anyio.create_task_group() as tasks:
            tasks.start_soon(emit, first, 2)
            tasks.start_soon(emit, second, 8)
        await first._refresh_states()
        meter = await first.customer_meter(
            external_customer_id="alice", meter_id="meter"
        )
        shared = await first.customer_meter(
            external_customer_id="alice", meter_id="shared"
        )
        average = await first.customer_meter(
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
        await first.ingest(
            events=[
                {
                    "name": "call",
                    "external_customer_id": "alice",
                    "timestamp": "2026-10-12T12:05:00Z",
                    "metadata": {"tokens": 4},
                }
            ]
        )
        await apply_snapshot(
            keys=[f"outpost:state:{identity}"],
            args=[
                identity,
                "outpost:0:updates",
                "epoch",
                BUCKET + BUCKET_SIZE,
                21,
                "meter",
                150,
                22,
                120,
                2,
                15,
            ],
        )
        await first._refresh_states()
        assert (
            await redis.hget(f"outpost:state:{identity}", f"bucket:{BUCKET}:sum")
            is None
        )
        assert (
            await redis.hget(
                "outpost:state:external:alice:average", f"bucket:{BUCKET}:sum"
            )
            == b"100"
        )
        meter = await first.customer_meter(
            external_customer_id="alice", meter_id="meter"
        )
        average = await first.customer_meter(
            external_customer_id="alice", meter_id="average-meter"
        )
        shared = await first.customer_meter(
            external_customer_id="alice", meter_id="shared"
        )
        assert meter is not None and meter.consumed_units == 124 and meter.balance == 26
        assert average is not None and average.consumed_units == pytest.approx(124 / 23)
        assert shared is not None and shared.credited_units == 200
        assert await redis.exists("outpost:state:customer:alice:tokens") == 0


@pytest.mark.anyio
async def test_cutoff_keeps_microsecond_precision(
    redis_connection: tuple[str, Redis],
) -> None:
    _, redis = redis_connection
    identity = "external:alice:tokens"
    key = f"outpost:state:{identity}"
    prefix = [identity, "outpost:0:updates", "epoch"]
    write = redis.register_script(WRITE_BUCKET_SCRIPT)
    snapshot = redis.register_script(APPLY_SNAPSHOT_SCRIPT)
    await write(keys=[key], args=[*prefix, BUCKET, 1, 2, 2, 2])
    await write(keys=[key], args=[*prefix, BUCKET + BUCKET_SIZE, 1, 4, 4, 4])
    await snapshot(
        keys=[key],
        args=[
            *prefix,
            BUCKET + 1,
            1791806400000001,
            "meter",
            100,
            1,
            2,
            2,
            2,
        ],
    )
    assert await redis.hget(key, "cold_until") == str(BUCKET + 1).encode()
    assert await redis.hget(key, f"bucket:{BUCKET}:sum") is None
    assert await redis.hget(key, f"bucket:{BUCKET + BUCKET_SIZE}:sum") == b"4"
    await write(keys=[key], args=[*prefix, BUCKET, 1, 999, 999, 999])
    assert await redis.hget(key, f"bucket:{BUCKET}:sum") is None


@pytest.mark.anyio
async def test_telemetry_spans(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
    exported_spans: list[ReadableSpan],
) -> None:
    url, _ = redis_connection
    snapshots["external:alice"] = {
        "customer_id": None,
        "external_customer_id": "alice",
        "meter_id": "meter",
        "version": 1791807000000000,
        "cold_until": 1791806700000000,
        "count": 0,
        "sum": 0,
        "min": None,
        "max": None,
        "credited_units": 10,
    }
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.ingest(
            events=[
                {
                    "name": "call",
                    "external_customer_id": "alice",
                    "metadata": {"tokens": 3},
                }
            ]
        )
        with anyio.fail_after(1):
            while not {"outpost.snapshot.received", "outpost.sync.received"} <= {
                span.name for span in exported_spans
            }:
                await anyio.lowlevel.checkpoint()
        await outpost.customer_meter(meter_id="meter", external_customer_id="alice")

    names = {span.name for span in exported_spans}
    assert names == {
        "outpost.redis.connect",
        "outpost.redis.subscribe",
        "outpost.websocket.connect",
        "outpost.ingest",
        "outpost.customer_meter",
        "outpost.snapshot.received",
        "outpost.sync.received",
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
        await outpost.ingest(events=[{"name": "call", "external_customer_id": "alice"}])
        await outpost.flush_telemetry()
    assert exported_spans == []


@pytest.mark.anyio
async def test_flush_telemetry_exports_buffered_spans(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    exported_spans: list[ReadableSpan],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "polar.outpost.telemetry.BatchSpanProcessor", BatchSpanProcessor
    )
    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.ingest(events=[{"name": "call", "external_customer_id": "alice"}])
        assert exported_spans == []
        assert await outpost.flush_telemetry()
        assert "outpost.ingest" in {span.name for span in exported_spans}


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
        "outpost:state:external:alice:tokens",
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
    snapshots["external:alice"] = {
        "customer_id": None,
        "external_customer_id": "alice",
        "meter_id": "meter",
        "version": 1791807000000000,
        "cold_until": BUCKET,
        "count": 2,
        "sum": snapshot_sum,
        "min": 3,
        "max": snapshot_max,
        "credited_units": 10,
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
    assert span.attributes["outpost.local.count"] == 2
    assert span.attributes["outpost.local.sum"] == 8
    assert span.attributes["outpost.local.min"] == 3
    assert span.attributes["outpost.local.max"] == 5
    assert span.attributes["outpost.snapshot.sum"] == snapshot_sum
    assert span.attributes["outpost.snapshot.delta"] is delta


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
        result = await outpost.ingest(
            events=[{"name": "call", "external_customer_id": "alice"}]
        )
        with anyio.fail_after(1):
            while outpost.connection_id != "second":
                await anyio.lowlevel.checkpoint()
        assert outpost.connected

    assert result.inserted == 1
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


def test_backoff_delay_stays_bounded() -> None:
    assert 15 <= _backoff_delay(5000, 0.5, 30) <= 30


ALICE_SNAPSHOT: dict[str, typing.Any] = {
    "customer_id": None,
    "external_customer_id": "alice",
    "meter_id": "meter",
    "version": 1791807000000000,
    "cold_until": 1791806700000000,
    "count": 1,
    "sum": 3,
    "min": 3,
    "max": 3,
    "credited_units": 10,
}


@pytest.mark.anyio
async def test_cold_read_waits_for_the_snapshot(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
) -> None:
    url, _ = redis_connection
    snapshots["external:alice"] = ALICE_SNAPSHOT
    async with Outpost(url, client=polar_client) as outpost:
        meter = await outpost.customer_meter(
            meter_id="meter", external_customer_id="alice"
        )
    assert meter is not None
    assert meter.balance == 7


@pytest.mark.anyio
async def test_unknown_customer_reads_none(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
) -> None:
    url, _ = redis_connection
    snapshots["external:alice"] = {**ALICE_SNAPSHOT, "customer_exists": False}
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        assert (
            await outpost.customer_meter(meter_id="meter", external_customer_id="alice")
            is None
        )


@pytest.mark.anyio
async def test_missing_snapshot_times_out(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, _ = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        with pytest.raises(PolarOutpostError, match="not ready"):
            await outpost.customer_meter(meter_id="meter", external_customer_id="alice")


@pytest.mark.anyio
async def test_cold_read_waits_for_its_own_meter(
    redis_connection: tuple[str, Redis],
) -> None:
    url, _ = redis_connection
    configuration = copy.deepcopy(CONFIGURATION)
    configuration["reducers"][0]["meter_ids"].append("shared")
    credits = {"meter": 100, "shared": 200}

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
                meter_id = request["payload"]["meter_id"]
                if meter_id == "shared":
                    await anyio.sleep(0.05)
                payload = {
                    **ALICE_SNAPSHOT,
                    "customer_exists": True,
                    "meter_id": meter_id,
                    "credited_units": credits[meter_id],
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
        meter = await outpost.customer_meter(
            meter_id="shared", external_customer_id="alice"
        )
    assert meter is not None
    assert meter.credited_units == 200


@pytest.mark.anyio
async def test_unknown_customer_reads_its_value_once_created(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    snapshots: dict[str, dict[str, typing.Any]],
) -> None:
    url, _ = redis_connection
    snapshots["external:alice"] = {**ALICE_SNAPSHOT, "customer_exists": False}
    async with Outpost(url, client=polar_client) as outpost:
        read = functools.partial(
            outpost.customer_meter, meter_id="meter", external_customer_id="alice"
        )
        assert await read() is None
        snapshots["external:alice"] = ALICE_SNAPSHOT
        with anyio.fail_after(1):
            while (meter := await read()) is None:
                await anyio.sleep(0.01)
    assert meter.balance == 7
