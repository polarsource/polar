import asyncio
import collections.abc
import gc
import os
import subprocess
import tempfile
import time

import pytest


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
