import anyio
import pytest
from httpx2 import AsyncClient
from httpx2.websockets import ASGIWebSocketTransport
from starlette.applications import Starlette
from starlette.routing import WebSocketRoute
from starlette.websockets import WebSocket

from outpost.polar import Configuration, listen

from .conftest import POLAR_METERS, polar_websocket


def test_configuration_skips_unsupported_meters() -> None:
    configuration = Configuration()
    unsupported = {
        **POLAR_METERS[0],
        "id": "00000000-0000-0000-0000-000000000002",
        "aggregation": {"func": "unique", "property": "user"},
    }

    configuration.update([*POLAR_METERS, unsupported])

    assert [meter["id"] for meter, _ in configuration.meters] == [POLAR_METERS[0]["id"]]
    assert configuration.ready.is_set()


@pytest.mark.anyio
async def test_listen_reconnects(monkeypatch: pytest.MonkeyPatch) -> None:
    connections = 0

    async def flaky_polar(websocket: WebSocket) -> None:
        nonlocal connections
        connections += 1
        if connections == 1:
            await websocket.accept()
            await websocket.close()
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
