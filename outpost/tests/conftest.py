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
POLAR_REDUCERS: list[dict[str, typing.Any]] = [
    {
        "id": "00000000-0000-0000-0000-000000000011",
        "filter": POLAR_METERS[0]["filter"],
        "aggregation": POLAR_METERS[0]["aggregation"],
        "meter_ids": [POLAR_METERS[0]["id"]],
    }
]


POLAR_SNAPSHOT_REQUESTS: list[str] = []


def polar_snapshot(external_customer_id: str) -> dict[str, typing.Any]:
    return {
        "external_customer_id": external_customer_id,
        "sealed_until": 300,
        "sealed": {POLAR_REDUCERS[0]["id"]: 10},
        "buckets": [],
    }


async def polar_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    async for message in websocket.iter_json():
        match message["type"]:
            case "configuration":
                await websocket.send_json(
                    {
                        "type": "configuration",
                        "payload": {"reducers": POLAR_REDUCERS},
                    }
                )
            case "snapshot":
                external_customer_id = message["payload"]["external_customer_id"]
                POLAR_SNAPSHOT_REQUESTS.append(external_customer_id)
                await websocket.send_json(
                    {
                        "type": "snapshot",
                        "payload": polar_snapshot(external_customer_id),
                    }
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
