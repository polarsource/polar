import collections.abc
import contextlib
import json
import typing

import anyio
import httpx2
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from polar.integrations.fastapi import PolarDependency, PolarMiddleware
from polar.metering.events import EventInput
from polar.metering.queue.memory import MemoryEventQueue
from polar.{{ ir.versions[0] | format_version }} import PolarAsync


def test_drains_events_after_app_shutdown_and_before_closing_http(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue = MemoryEventQueue(batch_interval=60)
    clients: list[PolarAsync] = []
    delivered: list[EventInput] = []
    acknowledged: list[EventInput] = []
    shutdown_finished = False

    @contextlib.asynccontextmanager
    async def lifespan(_app: FastAPI) -> collections.abc.AsyncGenerator[None, None]:
        nonlocal shutdown_finished
        with anyio.CancelScope():
            yield
        shutdown_finished = True

    app = FastAPI(lifespan=lifespan)

    async def send(
        client: httpx2.AsyncClient, request: httpx2.Request, **_options: object
    ) -> httpx2.Response:
        assert shutdown_finished
        assert not client.is_closed
        assert request.url.path == "/v1/events/ingest"
        delivered.extend(json.loads(request.content)["events"])
        return httpx2.Response(202, json={"inserted": 2, "duplicates": 0}, request=request)

    async def on_ack(events: list[EventInput]) -> None:
        acknowledged.extend(events)

    monkeypatch.setattr(httpx2.AsyncClient, "send", send)
    app.add_middleware(
        PolarMiddleware,
        client_class=PolarAsync,
        access_token="test-token",
        event_queue=queue,
        on_event_ack=on_ack,
    )

    @app.post("/events")
    async def track(request: Request, polar: PolarDependency[PolarAsync]) -> None:
        typing.assert_type(polar, PolarAsync)
        assert polar is request.state.polar
        clients.append(polar)
        await polar.track(name="api_request", external_customer_id="customer-123")

    with TestClient(app) as client:
        assert client.post("/events").status_code == 200
        assert client.post("/events").status_code == 200
        assert clients[0] is clients[1]
        assert not delivered

    assert shutdown_finished
    assert [event["name"] for event in delivered] == ["api_request", "api_request"]
    assert acknowledged == delivered
    assert clients[0]._client._client.is_closed
    assert "polar" not in client.app_state
