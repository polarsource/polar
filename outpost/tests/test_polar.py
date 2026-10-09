import typing

import anyio
import pytest
from httpx2 import AsyncClient
from httpx2.websockets import ASGIWebSocketTransport
from starlette.applications import Starlette
from starlette.routing import WebSocketRoute
from starlette.websockets import WebSocket

from outpost.polar import Configuration, listen

from .conftest import POLAR_REDUCERS, polar_websocket


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
    app = Starlette(routes=[WebSocketRoute("/v1/outpost/", flaky_polar)])
    async with (
        AsyncClient(
            base_url="http://polar", transport=ASGIWebSocketTransport(app)
        ) as client,
        anyio.create_task_group() as tg,
    ):
        tg.start_soon(listen, client, configuration)
        with anyio.fail_after(5):
            await configuration.ready.wait()
        tg.cancel_scope.cancel()

    assert connections == 2
