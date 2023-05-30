import redis.asyncio as _async_redis
import redis as _sync_redis

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


def get_redis() -> _async_redis.Redis: # type: ignore
    return _async_redis.Redis(connection_pool=async_pool)


def get_sync_redis() -> _sync_redis.Redis: # type: ignore
    return _sync_redis.Redis(connection_pool=sync_pool)


redis = get_redis()
Redis = _async_redis.Redis
sync_redis = get_sync_redis()

__all__ = ["redis", "sync_redis", "Redis"]
