from typing import TYPE_CHECKING, Literal

import redis.asyncio as _async_redis
from fastapi import Request
from redis import ConnectionError, RedisError, TimeoutError
from redis.asyncio.retry import Retry
from redis.backoff import default_backoff

from polar.config import settings

# https://github.com/python/typeshed/issues/7597#issuecomment-1117551641
# Redis is generic at type checking, but not at runtime...
if TYPE_CHECKING:
    Redis = _async_redis.Redis[str]
else:
    Redis = _async_redis.Redis


REDIS_RETRY_ON_ERRROR: list[type[RedisError]] = [ConnectionError, TimeoutError]
REDIS_RETRY = Retry(default_backoff(), retries=50)

type ProcessName = Literal["app", "rate-limit", "worker", "script"]


def create_redis(process_name: ProcessName) -> Redis:
    return _async_redis.Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        retry_on_error=REDIS_RETRY_ON_ERRROR,
        retry=REDIS_RETRY,
        client_name=f"{settings.ENV.value}.{process_name}",
    )


async def get_redis(request: Request) -> Redis:
    return request.state.redis


__all__ = [
    "REDIS_RETRY",
    "REDIS_RETRY_ON_ERRROR",
    "Redis",
    "create_redis",
    "get_redis",
]
