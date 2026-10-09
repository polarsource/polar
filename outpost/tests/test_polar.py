import typing

import anyio
import pytest
from httpx2 import AsyncClient
from httpx2.websockets import ASGIWebSocketTransport
from starlette.applications import Starlette
from starlette.routing import WebSocketRoute
from starlette.websockets import WebSocket

from outpost.env import Environment
from outpost.polar import Configuration, Snapshots, listen
from outpost.reducer import get_consumed
from outpost.storage.memory import MemoryStorage

from .conftest import (
    POLAR_REDUCERS,
    POLAR_SNAPSHOT_REQUESTS,
    polar_app,
    polar_snapshot,
    polar_websocket,
)


def test_configuration_skips_unsupported_reducers() -> None:
    configuration = Configuration()
    unsupported = {
        **POLAR_REDUCERS[0],
        "id": "00000000-0000-0000-0000-000000000012",
        "aggregation": {"func": "unique", "property": "user"},
    }

    configuration.update([*POLAR_REDUCERS, unsupported])

    assert [reducer["id"] for reducer, _ in configuration.reducers] == [
        POLAR_REDUCERS[0]["id"]
    ]
    assert configuration.ready.is_set()


async def close(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.close()


async def send_malformed_message(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.receive_json()
    await websocket.send_json({})


@pytest.mark.anyio
@pytest.mark.parametrize("first_connection", [close, send_malformed_message])
async def test_listen_reconnects(
    monkeypatch: pytest.MonkeyPatch,
    first_connection: typing.Callable[[WebSocket], typing.Awaitable[None]],
) -> None:
    connections = 0

    async def flaky_polar(websocket: WebSocket) -> None:
        nonlocal connections
        connections += 1
        if connections == 1:
            await first_connection(websocket)
            return
        await polar_websocket(websocket)

    async def no_sleep(_: float) -> None:
        pass

    monkeypatch.setattr(anyio, "sleep", no_sleep)
    configuration = Configuration()
    snapshots = Snapshots()
    storage = MemoryStorage()
    warm = snapshots.warm_up("customer")
    app = Starlette(routes=[WebSocketRoute("/v1/outpost/", flaky_polar)])
    async with (
        AsyncClient(
            base_url="http://polar", transport=ASGIWebSocketTransport(app)
        ) as client,
        anyio.create_task_group() as tg,
    ):
        tg.start_soon(listen, client, configuration, snapshots, storage)
        with anyio.fail_after(5):
            await configuration.ready.wait()
            await warm.wait()
        tg.cancel_scope.cancel()

    assert connections == 2
    assert (await storage.read("customer"))["cold"] == polar_snapshot("customer")[
        "cold"
    ]


@pytest.mark.anyio
async def test_listen_applies_snapshots() -> None:
    configuration = Configuration()
    snapshots = Snapshots()
    storage = MemoryStorage()
    async with (
        AsyncClient(
            base_url="http://polar", transport=ASGIWebSocketTransport(polar_app)
        ) as client,
        anyio.create_task_group() as tg,
    ):
        tg.start_soon(listen, client, configuration, snapshots, storage)
        with anyio.fail_after(5):
            await configuration.ready.wait()
            assert snapshots.warm_up("customer") is snapshots.warm_up("customer")
            await snapshots.warm_up("customer").wait()
        tg.cancel_scope.cancel()

    assert await storage.read("customer") == {
        "cold_until": 300,
        "cold": polar_snapshot("customer")["cold"],
        "credited": polar_snapshot("customer")["credited"],
        "buckets": {},
    }


@pytest.mark.anyio
async def test_snapshots_read_requests_an_expired_snapshot() -> None:
    configuration = Configuration()
    snapshots = Snapshots()
    storage = MemoryStorage()
    async with (
        AsyncClient(
            base_url="http://polar", transport=ASGIWebSocketTransport(polar_app)
        ) as client,
        anyio.create_task_group() as tg,
    ):
        tg.start_soon(listen, client, configuration, snapshots, storage)
        with anyio.fail_after(5):
            await configuration.ready.wait()
            await snapshots.read(storage, "customer", timeout=5)
            storage.snapshots.clear()
            customer = await snapshots.read(storage, "customer", timeout=5)
        tg.cancel_scope.cancel()

    assert customer is not None
    assert customer["cold"] == polar_snapshot("customer")["cold"]
    assert POLAR_SNAPSHOT_REQUESTS.count("customer") == 2


@pytest.mark.anyio
async def test_fake_snapshots(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POLAR_OUTPOST_FAKE_SNAPSHOTS", "true")
    configuration = Configuration()
    snapshots = Snapshots(fake=Environment().fake_snapshots)
    storage = MemoryStorage()
    warm = snapshots.warm_up("customer")
    reducer_id = POLAR_REDUCERS[0]["id"]
    await storage.write_updates({("customer", reducer_id, 300, "count"): 2})

    async with (
        AsyncClient(
            base_url="http://polar", transport=ASGIWebSocketTransport(polar_app)
        ) as client,
        anyio.create_task_group() as tg,
    ):
        tg.start_soon(listen, client, configuration, snapshots, storage)
        with anyio.fail_after(5):
            await configuration.ready.wait()
            await warm.wait()
            customer = await snapshots.read(storage, "customer", timeout=5)
            empty = await snapshots.read(storage, "silent_customer", timeout=5)
        tg.cancel_scope.cancel()

    assert customer == {
        "cold_until": 0,
        "cold": {},
        "credited": {},
        "buckets": {(reducer_id, 300): 2},
    }
    assert empty == {"cold_until": 0, "cold": {}, "credited": {}, "buckets": {}}
    reducer = configuration.reducers[0][0]
    assert get_consumed(reducer, customer) == 2
    assert get_consumed(reducer, empty) == 0
    assert POLAR_SNAPSHOT_REQUESTS == []


@pytest.mark.anyio
async def test_snapshots_read_times_out() -> None:
    snapshots = Snapshots()

    assert await snapshots.read(MemoryStorage(), "customer", timeout=0.01) is None
