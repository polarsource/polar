from typing import TYPE_CHECKING

import redis as _sync_redis
import redis.asyncio as _async_redis

from polar.config import settings


def create_async_connection_pool() -> _async_redis.ConnectionPool:
    return _async_redis.ConnectionPool.from_url(
        settings.redis_url, decode_responses=True
    )


async_pool = create_async_connection_pool()


def create_sync_connection_pool() -> _sync_redis.ConnectionPool:
    return _sync_redis.ConnectionPool.from_url(
        settings.redis_url, decode_responses=True
    )


sync_pool = create_sync_connection_pool()

# https://github.com/python/typeshed/issues/7597#issuecomment-1117551641
# Redis is generic at type checking, but not at runtime...
if TYPE_CHECKING:
    Redis = _async_redis.Redis[bytes]
    SyncRedis = _sync_redis.Redis[bytes]
else:
    Redis = _async_redis.Redis
    SyncRedis = _sync_redis.Redis


def get_redis() -> Redis:
    return _async_redis.Redis(connection_pool=async_pool)


def get_sync_redis() -> SyncRedis:
    return _sync_redis.Redis(connection_pool=sync_pool)


redis = get_redis()

sync_redis = get_sync_redis()

__all__ = ["redis", "sync_redis", "Redis"]
