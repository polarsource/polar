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
from httpx_ws.transport import ASGIWebSocketTransport
from redis import Redis

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


# Polar's side of the WebSocket: the configuration, nothing else.
def polar_server(reducers: list[Reducer]) -> typing.Any:
    async def app(scope: typing.Any, receive: typing.Any, send: typing.Any) -> None:
        await receive()
        await send({"type": "websocket.accept"})
        await send(
            {
                "type": "websocket.send",
                "text": json.dumps({"type": "connection", "payload": {"id": "bench"}}),
            }
        )
        while (message := await receive())["type"] != "websocket.disconnect":
            if json.loads(message["text"])["type"] == "configuration":
                payload = {"reducers": reducers}
                await send(
                    {
                        "type": "websocket.send",
                        "text": json.dumps(
                            {"type": "configuration", "payload": payload}
                        ),
                    }
                )

    return app


# One task holds the Outpost open, since a task group must close in the task that opened it;
# the benchmarks drive it from their own tasks on the same loop.
@pytest.fixture(scope="module")
def outpost(
    loop: asyncio.AbstractEventLoop,
    redis: Redis,
    redis_socket: str,
    reducers: list[Reducer],
) -> collections.abc.Iterator[Outpost]:
    client = httpx.AsyncClient(
        base_url="http://polar.test",
        transport=ASGIWebSocketTransport(polar_server(reducers)),
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
