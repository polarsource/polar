import collections.abc
import sys
import types
import typing

import pytest
from asgiref.testing import ApplicationCommunicator
from asgiref.typing import (
    ASGIReceiveCallable,
    ASGISendCallable,
    ASGISendEvent,
    HTTPScope,
    LifespanScope,
    Scope,
)

from polar.integrations.asgi import PolarMiddleware
from polar.v2026_04 import PolarAsync


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_reuses_the_selected_client_until_lifespan_shutdown() -> None:
    clients: list[PolarAsync] = []
    request: HTTPScope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "root_path": "",
        "headers": [],
        "client": None,
        "server": None,
        "extensions": None,
    }
    startup: LifespanScope = {
        "type": "lifespan",
        "asgi": {"version": "3.0", "spec_version": "2.0"},
        "state": {},
    }

    async def app(
        scope: Scope, receive: ASGIReceiveCallable, send: ASGISendCallable
    ) -> None:
        if scope["type"] == "lifespan":
            assert await receive() == {"type": "lifespan.startup"}
            client = scope["state"]["polar"]
            assert isinstance(client, PolarAsync)
            http = client._client._client
            assert not http.is_closed
            assert http.base_url.host == "polar.test"
            assert http.headers["Authorization"] == "Bearer test-token"
            assert http.headers["Polar-Organization"] == "org"
            await send({"type": "lifespan.startup.complete"})
            assert await receive() == {"type": "lifespan.shutdown"}
            assert not http.is_closed
            await send({"type": "lifespan.shutdown.complete"})
            return
        assert receive is receive_message
        assert send is send_message
        client = scope["state"]["polar"]
        assert isinstance(client, PolarAsync)
        assert not client._client._client.is_closed
        clients.append(client)

    async def receive_message() -> typing.Never:
        raise AssertionError("The middleware must forward receive")

    async def send_message(message: ASGISendEvent) -> typing.Never:
        raise AssertionError("The middleware must forward send")

    middleware = PolarMiddleware(
        app,
        PolarAsync,
        "test-token",
        base_url="https://polar.test",
        organization_id="org",
    )
    lifespan = ApplicationCommunicator(middleware, startup)
    try:
        await lifespan.send_input({"type": "lifespan.startup"})
        assert await lifespan.receive_output() == {"type": "lifespan.startup.complete"}
        client = startup["state"]["polar"]
        for _ in range(2):
            await middleware(
                {**request, "state": startup["state"].copy()},
                receive_message,
                send_message,
            )
        assert len(clients) == 2
        assert clients[0] is clients[1] is client
        await lifespan.send_input({"type": "lifespan.shutdown"})
        assert await lifespan.receive_output() == {"type": "lifespan.shutdown.complete"}
        assert client._client._client.is_closed
        assert "polar" not in startup["state"]
        await lifespan.wait()
    finally:
        lifespan.stop(exceptions=False)


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.parametrize(
    ("has_vercel_sdk", "has_queue"), [(True, True), (False, True), (True, False)]
)
async def test_flushes_events_after_vercel_http_requests(
    monkeypatch: pytest.MonkeyPatch, has_vercel_sdk: bool, has_queue: bool
) -> None:
    pending: list[collections.abc.Awaitable[object]] = []
    calls: list[str] = []
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setitem(
        sys.modules,
        "vercel.functions",
        types.SimpleNamespace(wait_until=pending.append) if has_vercel_sdk else None,
    )

    async def flush() -> None:
        calls.append("flush")

    async def app(
        scope: Scope, receive: ASGIReceiveCallable, send: ASGISendCallable
    ) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [],
                "trailers": False,
            }
        )
        await send({"type": "http.response.body", "body": b"", "more_body": False})
        calls.append("app finished")

    polar = (
        PolarAsync("test-token")
        if has_queue
        else PolarAsync("test-token", event_queue=None)
    )
    monkeypatch.setattr(polar, "flush", flush)
    request = ApplicationCommunicator(
        PolarMiddleware(app, PolarAsync, "test-token"),
        {"type": "http", "state": {"polar": polar}},
    )
    await request.wait()

    if not has_queue:
        assert calls == ["app finished"]
        assert not pending
        return
    if has_vercel_sdk:
        assert calls == ["app finished"]
        assert len(pending) == 1
        await pending[0]
    assert calls == ["app finished", "flush"]
