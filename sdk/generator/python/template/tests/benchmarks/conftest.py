import asyncio
import collections.abc
import gc

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
