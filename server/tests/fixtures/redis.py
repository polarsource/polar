import pytest
from fakeredis import FakeAsyncRedis
from pytest_mock import MockerFixture

from polar.redis import Redis


@pytest.fixture(autouse=True)
async def redis() -> Redis:
    return FakeAsyncRedis()


@pytest.fixture(autouse=True)
def patch_reducer_redis(mocker: MockerFixture, redis: Redis) -> None:
    mocker.patch("polar.reducer.service.create_redis", return_value=redis)


@pytest.fixture(autouse=True)
def patch_webhook_eventstream_redis(mocker: MockerFixture, redis: Redis) -> None:
    """Ensure publish_webhook_event uses fakeredis instead of a real connection."""
    mocker.patch(
        "polar.webhook.eventstream._get_check_redis",
        return_value=redis,
    )
