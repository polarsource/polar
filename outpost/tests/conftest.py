import collections.abc
import typing

import pytest
from httpx2 import ASGITransport, AsyncClient
from httpx2.websockets import ASGIWebSocketTransport
from starlette.applications import Starlette
from starlette.routing import WebSocketRoute
from starlette.types import Receive, Scope, Send
from starlette.websockets import WebSocket

import outpost
from outpost import app

POLAR_METERS: list[dict[str, typing.Any]] = [
    {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "Tool calls",
        "filter": {
            "conjunction": "and",
            "clauses": [{"property": "name", "operator": "eq", "value": "tool_call"}],
        },
        "aggregation": {"func": "count"},
    }
]


async def polar_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    async for message in websocket.iter_json():
        if message["type"] == "configuration":
            await websocket.send_json(
                {"type": "configuration", "payload": {"meters": POLAR_METERS}}
            )


polar_app = Starlette(routes=[WebSocketRoute("/v1/outpost/", polar_websocket)])


@pytest.fixture(autouse=True)
def polar_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POLAR_TOKEN", "polar_oat_test")


@pytest.fixture
def polar(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        outpost,
        "create_client",
        lambda _: AsyncClient(
            base_url="http://polar", transport=ASGIWebSocketTransport(polar_app)
        ),
    )


@pytest.fixture
async def client(polar: None) -> collections.abc.AsyncGenerator[AsyncClient]:
    async with app.router.lifespan_context(app) as state:

        async def app_with_state(scope: Scope, receive: Receive, send: Send) -> None:
            scope["state"] = dict(state or {})
            await app(scope, receive, send)

        async with AsyncClient(
            base_url="http://testserver", transport=ASGITransport(app_with_state)
        ) as client:
            yield client
