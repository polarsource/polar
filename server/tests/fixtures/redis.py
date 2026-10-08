from collections.abc import AsyncIterator

import pytest
from fakeredis import FakeAsyncRedis, FakeServer
from pytest_mock import MockerFixture

from polar.redis import Redis


@pytest.fixture(autouse=True)
async def redis(redis_server: FakeServer) -> Redis:
    return FakeAsyncRedis(server=redis_server)


@pytest.fixture
def redis_server() -> FakeServer:
    return FakeServer()


@pytest.fixture(autouse=True)
async def reducer_redis(
    mocker: MockerFixture, redis_server: FakeServer
) -> AsyncIterator[Redis]:
    async with FakeAsyncRedis(server=redis_server, decode_responses=True) as redis:
        mocker.patch("polar.reducer.service.create_redis", return_value=redis)
        yield redis


@pytest.fixture(autouse=True)
def patch_webhook_eventstream_redis(mocker: MockerFixture, redis: Redis) -> None:
    """Ensure publish_webhook_event uses fakeredis instead of a real connection."""
    mocker.patch(
        "polar.webhook.eventstream._get_check_redis",
        return_value=redis,
    )
