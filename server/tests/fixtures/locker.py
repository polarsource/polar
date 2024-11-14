import pytest_asyncio

from polar.locker import Locker
from polar.redis import Redis


@pytest_asyncio.fixture
async def locker(redis: Redis) -> Locker:
    return Locker(redis)
