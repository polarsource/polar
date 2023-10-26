from typing import TYPE_CHECKING

import redis.asyncio as _async_redis

from polar.config import settings

# https://github.com/python/typeshed/issues/7597#issuecomment-1117551641
# Redis is generic at type checking, but not at runtime...
if TYPE_CHECKING:
    Redis = _async_redis.Redis[str]
else:
    Redis = _async_redis.Redis


def create_async_connection_pool() -> _async_redis.ConnectionPool:
    return _async_redis.ConnectionPool.from_url(
        settings.redis_url, decode_responses=True
    )


async_pool = create_async_connection_pool()


def get_redis() -> Redis:
    return _async_redis.Redis(connection_pool=async_pool)


redis = get_redis()

__all__ = ["redis", "Redis"]
