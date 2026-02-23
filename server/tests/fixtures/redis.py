from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from fakeredis import FakeAsyncRedis
from pytest_mock import MockerFixture

from polar.redis import Redis


@pytest_asyncio.fixture(autouse=True)
async def redis() -> AsyncIterator[Redis]:
    yield FakeAsyncRedis()


@pytest.fixture(autouse=True)
def patch_webhook_eventstream_redis(mocker: MockerFixture, redis: Redis) -> None:
    """Ensure publish_webhook_event uses fakeredis instead of a real connection."""
    mocker.patch(
        "polar.webhook.eventstream._get_check_redis",
        return_value=redis,
    )
