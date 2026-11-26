from collections.abc import Iterator
from unittest.mock import patch

import pytest
from fakeredis import FakeAsyncRedis

from polar.redis import Redis

_active_redis: Redis | None = None


def get_active_redis() -> Redis:
    global _active_redis
    if _active_redis is None:
        _active_redis = FakeAsyncRedis(protocol=3)
    return _active_redis


@pytest.fixture(scope="session", autouse=True)
def patch_webhook_eventstream_redis_session() -> Iterator[None]:
    """Ensure publish_webhook_event uses fakeredis instead of a real connection."""
    with patch(
        "polar.webhook.eventstream._get_check_redis",
        side_effect=get_active_redis,
    ):
        yield


@pytest.fixture(autouse=True)
def patch_webhook_eventstream_redis() -> Iterator[None]:
    global _active_redis
    _active_redis = None
    yield
    _active_redis = None


@pytest.fixture
def redis() -> Redis:
    return get_active_redis()
