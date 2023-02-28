import redis.asyncio as _redis

from polar.config import settings


def create_connection_pool():
    return _redis.ConnectionPool.from_url(settings.redis_url, decode_responses=True)


pool = create_connection_pool()


def get_redis() -> _redis.Redis:
    return _redis.Redis(connection_pool=pool)


redis = get_redis()
Redis = _redis.Redis
PubSub = _redis.client.PubSub


__all__ = ["get_redis", "pool", "Redis", "redis"]
