import asyncio
import collections.abc
import gc
import json
import os
import subprocess
import tempfile
import time
import typing

import httpx
import pytest

from polar.outpost import telemetry
from polar.outpost.client import Outpost
from polar.outpost.reducer import Reducer


# A collection landing inside a measured call costs more than the call; measure allocations, not
# the collector's schedule.
@pytest.fixture(autouse=True)
def no_gc() -> collections.abc.Iterator[None]:
    gc.collect()
    gc.disable()
    yield
    gc.enable()


# pytest-codspeed cannot benchmark a coroutine (CodSpeedHQ/pytest-codspeed#101): one event loop
# drives the async calls, and its constant overhead is part of every measurement.
@pytest.fixture(scope="session")
def loop() -> collections.abc.Iterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# A throwaway redis-server on a Unix socket.
@pytest.fixture(scope="session")
def redis_socket() -> collections.abc.Iterator[str]:
    with tempfile.TemporaryDirectory(prefix="polar-outpost-bench-") as directory:
        socket = os.path.join(directory, "redis.sock")
        process = subprocess.Popen(
            [
                "redis-server",
                "--port",
                "0",
                "--unixsocket",
                socket,
                "--save",
                "",
                "--appendonly",
                "no",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            deadline = time.monotonic() + 5
            while not os.path.exists(socket):
                if process.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("redis-server did not start")
                time.sleep(0.01)
            yield socket
        finally:
            process.terminate()
            process.wait()


# Polar's side of Outpost: the configuration, the snapshot when given one, and no changes.
def polar_server(
    reducers: list[Reducer], snapshot: dict[str, typing.Any] | None
) -> typing.Any:
    cursor = 0

    async def app(scope: typing.Any, receive: typing.Any, send: typing.Any) -> None:
        nonlocal cursor
        body = (await receive()).get("body", b"")
        if scope["path"] == "/v1/outpost/configuration":
            response: typing.Any = {"organization_id": "org", "reducers": reducers}
        elif scope["path"] == "/v1/outpost/meter-usage":
            response = (
                [{"customer_exists": True, **snapshot, **json.loads(body)}]
                if snapshot is not None
                else []
            )
        else:
            cursor += 1
            response = {
                "changes": [],
                "cursor": f"{cursor}-0",
                "has_more": False,
                "reset": False,
                "configuration_changed": False,
                "next_poll_in": 30,
            }
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send(
            {"type": "http.response.body", "body": json.dumps(response).encode()}
        )

    return app


@pytest.fixture(scope="module")
def snapshot() -> dict[str, typing.Any] | None:
    return None


# One task holds the Outpost open, since a task group must close in the task that opened it;
# the benchmarks drive it from their own tasks on the same loop.
@pytest.fixture(scope="module")
def outpost(
    loop: asyncio.AbstractEventLoop,
    redis_socket: str,
    reducers: list[Reducer],
    snapshot: dict[str, typing.Any] | None,
) -> collections.abc.Iterator[Outpost]:
    client = httpx.AsyncClient(
        base_url="http://polar.test",
        transport=httpx.ASGITransport(polar_server(reducers, snapshot)),
    )
    outpost = Outpost(f"unix://{redis_socket}", client=client)
    stop = asyncio.Event()
    ready = loop.create_future()

    async def hold() -> None:
        async with client, outpost:
            ready.set_result(None)
            await stop.wait()

    # Telemetry records as in production; only its export to Polar stays on the machine.
    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr(telemetry._Relay, "_post", lambda self, body: True)
        held = loop.create_task(hold())
        loop.run_until_complete(
            asyncio.wait({ready, held}, return_when=asyncio.FIRST_COMPLETED)
        )
        if held.done():
            held.result()
        yield outpost
        stop.set()
        loop.run_until_complete(held)
