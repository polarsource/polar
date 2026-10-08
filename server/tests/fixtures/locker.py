import pytest

from polar.locker import Locker
from polar.redis import Redis


@pytest.fixture
async def locker(redis: Redis) -> Locker:
    return Locker(redis)
