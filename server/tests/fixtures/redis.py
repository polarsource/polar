from collections.abc import AsyncIterator

import pytest_asyncio
from fakeredis import FakeAsyncRedis

from polar.redis import Redis


@pytest_asyncio.fixture(autouse=True)
async def redis() -> AsyncIterator[Redis]:
    yield FakeAsyncRedis()
