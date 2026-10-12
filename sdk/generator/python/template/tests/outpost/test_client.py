import collections.abc
import copy
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
from redis.asyncio import Redis
from redis.asyncio.client import PubSub
from redis.exceptions import ConnectionError as RedisConnectionError

from polar import PolarDeserializationError, PolarError
from polar.outpost.client import APPLY_SNAPSHOT_SCRIPT, Outpost, connect_websocket
from polar.outpost.reducer import get_bucket_start
from polar.v{{ ir.versions[0].version | replace("-", "_") | replace(".", "_") }}.inputs import EventsIngest

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
            elif request["type"] == "snapshot":
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
                                {"type": "snapshot", "payload": snapshot}
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
    field = f"bucket:tokens:{BUCKET}"
    assert await redis.hget("outpost:state:external:alice", field) == b"3"
    assert [
        value
        for field, value in (
            await redis.hgetall("outpost:state:customer:alice")
        ).items()
        if isinstance(field, bytes) and field.startswith(b"bucket:")
    ] == [b"5"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("func", "expected"), [("count", 4), ("sum", 4), ("min", -2), ("max", 4)]
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
        "outpost:state:external:alice",
        mapping={
            "cold_until": BUCKET,
            "cold:tokens": 2,
            "credited:meter": 20,
            f"bucket:tokens:{BUCKET - 300}": 999,
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
        "outpost:state:customer:alice",
        mapping={
            "cold_until": BUCKET,
            "cold:tokens": 10,
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
            "outpost:state:customer:alice", f"bucket:tokens:{BUCKET - 300}"
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
        with pytest.raises(PolarError, match="snapshot is not ready"):
            await outpost.customer_meter(external_customer_id="alice", meter_id="meter")
    assert [
        message for message in websocket_requests if message["type"] == "snapshot"
    ] == [{"type": "snapshot", "payload": {"external_customer_id": "alice"}}]


@pytest.mark.anyio
async def test_invalid_batch_does_not_write_partial_usage(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, redis = redis_connection
    async with Outpost(url, client=polar_client) as outpost:
        with pytest.raises(ValueError, match="exactly one"):
            await outpost.ingest(
                events=[
                    {
                        "name": "call",
                        "external_customer_id": "bob",
                        "metadata": {"tokens": 1},
                    },
                    {"name": "call"},
                ]
            )
    assert not await redis.exists("outpost:state:external:bob")


@pytest.mark.anyio
async def test_repeated_reduction_and_concurrent_writers(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
) -> None:
    url, redis = redis_connection
    event = {
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
        await redis.hget("outpost:state:external:alice", f"bucket:tokens:{BUCKET}")
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
    with anyio.fail_after(1):
        async with (
            Outpost(url, client=polar_client) as outpost,
            anyio.create_task_group() as tasks,
        ):
            tasks.start_soon(
                functools.partial(
                    outpost.ingest,
                    events=[
                        {
                            "name": "call",
                            "external_customer_id": "alice",
                            "timestamp": TIMESTAMP,
                            "metadata": {"tokens": 3},
                        }
                    ],
                )
            )
            await anyio.lowlevel.checkpoint()
            assert not await redis.exists("outpost:state:external:alice")
            gate.set()
    assert (
        await redis.hget("outpost:state:external:alice", f"bucket:tokens:{BUCKET}")
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
    key = "outpost:state:external:alice"
    await redis.hset(
        key,
        mapping={
            "cold_until": BUCKET,
            "cold:tokens": 100,
            f"bucket:tokens:{BUCKET}": 7,
            f"bucket:tokens:{BUCKET + 300}": 4,
        },
    )
    async with (
        Outpost(url, client=polar_client) as owner,
        Outpost(url, client=polar_client) as reader,
    ):
        await reader.actor(external_customer_id="alice")
        with anyio.fail_after(1):
            while not any(
                message["type"] == "snapshot" for message in websocket_requests
            ):
                await anyio.lowlevel.checkpoint()
        snapshots["external:alice"] = {
            "external_customer_id": "alice",
            "cold_until": BUCKET + 300,
            "cold": {"tokens": 107},
            "credited": {"meter": 200},
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
    assert await redis.hget(key, f"bucket:tokens:{BUCKET}") is None
    assert await redis.hget(key, f"bucket:tokens:{BUCKET + 300}") == b"4"


@pytest.mark.anyio
async def test_duplicate_and_older_snapshots(
    redis_connection: tuple[str, Redis],
) -> None:
    _, redis = redis_connection
    apply_snapshot = redis.register_script(APPLY_SNAPSHOT_SCRIPT)
    key = "outpost:state:external:alice"
    prefix = ["external:alice", "outpost:0:updates", "epoch"]
    args = [*prefix, BUCKET, "cold:tokens", 10, "credited:meter", 20]
    await apply_snapshot(keys=[key], args=args)
    await apply_snapshot(keys=[key], args=args)
    await apply_snapshot(keys=[key], args=[*prefix, BUCKET - 300, "cold:tokens", 999])
    assert await redis.hget(key, "cold:tokens") == b"10"
    assert await redis.hget(key, "credited:meter") == b"20"


@pytest.mark.anyio
async def test_failed_configuration_closes_connections(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    configuration: dict[str, typing.Any],
) -> None:
    url, _ = redis_connection
    configuration.clear()
    outpost = Outpost(url, client=polar_client)
    with pytest.raises(ExceptionGroup) as exc:
        async with outpost:
            await outpost.ingest(
                events=[{"name": "call", "external_customer_id": "alice"}]
            )
    assert exc.value.subgroup(PolarDeserializationError) is not None
    assert not polar_client.is_closed
    with pytest.raises(RuntimeError, match="async with"):
        await outpost.actor(external_customer_id="alice")


@pytest.mark.anyio
async def test_warmed_reads_do_not_use_redis(
    redis_connection: tuple[str, Redis],
    polar_client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, redis = redis_connection
    await redis.hset(
        "outpost:state:external:alice",
        mapping={"cold_until": BUCKET, "cold:tokens": 10},
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
    key = "outpost:state:external:alice"
    await redis.hset(
        key,
        mapping={
            "cold_until": BUCKET,
            "cold:tokens": 10,
            "epoch": "first",
            "revision": 2**53 + 1,
        },
    )
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        received = anyio.Event()
        original = outpost._receive_state

        async def receive_state(customer: str, state: dict[str, str]) -> None:
            await original(customer, state)
            if state.get("cold:tokens") == "1":
                received.set()

        monkeypatch.setattr(outpost, "_receive_state", receive_state)
        old = {
            "customer": "external:alice",
            "state": [
                "cold_until",
                str(BUCKET),
                "cold:tokens",
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
        await redis.hset(key, mapping={"cold_until": BUCKET, "cold:tokens": 20})
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
    key = "outpost:state:external:alice"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:tokens": 1})
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await redis.hset(key, "cold:tokens", 2)
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
    key = "outpost:state:external:alice"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:tokens": 1})
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        disconnect = True
        await redis.hset(key, "cold:tokens", 2)
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
    key = "outpost:state:external:alice"
    await redis.hset(key, mapping={"cold_until": BUCKET, "cold:tokens": 1})
    async with Outpost(url, client=polar_client) as outpost:
        await outpost.actor(external_customer_id="alice")
        await outpost.actor(external_customer_id="bob")
        await outpost.actor(external_customer_id="carol")
        await redis.hset(key, "cold:tokens", 2)
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
