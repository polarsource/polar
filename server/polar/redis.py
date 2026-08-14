import socket
import sys
from typing import TYPE_CHECKING, Any, Literal

import redis as _sync_redis
import redis.asyncio as _async_redis
from fastapi import Request
from redis import ConnectionError, ReadOnlyError, RedisError, TimeoutError
from redis.asyncio.retry import Retry
from redis.backoff import default_backoff

from polar.config import settings

# https://github.com/python/typeshed/issues/7597#issuecomment-1117551641
# Redis is generic at type checking, but not at runtime...
if TYPE_CHECKING:
    Redis = _async_redis.Redis[str]
    _Pipeline = _async_redis.client.Pipeline[str]
    _SyncRedis = _sync_redis.Redis[bytes]
    _SyncPipeline = _sync_redis.client.Pipeline[bytes]
else:
    Redis = _async_redis.Redis
    _Pipeline = _async_redis.client.Pipeline
    _SyncRedis = _sync_redis.Redis
    _SyncPipeline = _sync_redis.client.Pipeline


# A demoted primary answers READONLY until DNS flips; dropping idle connections on
# the first one (via redis-py's per-attempt failure hooks) makes the whole pool
# re-resolve while the command keeps retrying, without surfacing an error.


class FailoverPipeline(_Pipeline):
    async def _disconnect_raise_on_watching(self, conn: Any, error: Exception) -> None:
        if isinstance(error, ReadOnlyError):
            await self.connection_pool.disconnect(inuse_connections=False)
        await super()._disconnect_raise_on_watching(conn, error)  # type: ignore[misc]


class FailoverRedis(Redis):
    async def _close_connection(self, conn: Any) -> None:
        if isinstance(sys.exc_info()[1], ReadOnlyError):
            await self.connection_pool.disconnect(inuse_connections=False)
        await super()._close_connection(conn)  # type: ignore[misc]

    def pipeline(
        self, transaction: bool = True, shard_hint: str | None = None
    ) -> "_Pipeline":
        return FailoverPipeline(
            self.connection_pool, self.response_callbacks, transaction, shard_hint
        )


class SyncFailoverPipeline(_SyncPipeline):
    def _disconnect_raise_on_watching(self, conn: Any, error: Exception) -> None:
        if isinstance(error, ReadOnlyError):
            self.connection_pool.disconnect(inuse_connections=False)
        super()._disconnect_raise_on_watching(conn, error)  # type: ignore[misc]


class SyncFailoverRedis(_SyncRedis):
    def _close_connection(self, conn: Any) -> None:
        if isinstance(sys.exc_info()[1], ReadOnlyError):
            self.connection_pool.disconnect(inuse_connections=False)
        super()._close_connection(conn)  # type: ignore[misc]

    def pipeline(
        self, transaction: bool = True, shard_hint: str | None = None
    ) -> "_SyncPipeline":
        return SyncFailoverPipeline(
            self.connection_pool, self.response_callbacks, transaction, shard_hint
        )


REDIS_RETRY_ON_ERRROR: list[type[RedisError]] = [
    ConnectionError,
    ReadOnlyError,
    TimeoutError,
]
REDIS_RETRY = Retry(default_backoff(), retries=50)

# TCP_KEEPIDLE is Linux, TCP_KEEPALIVE its macOS equivalent
REDIS_KEEPALIVE_OPTIONS: dict[int, int] = {
    getattr(socket, name): value
    for name, value in (
        ("TCP_KEEPIDLE", 60),
        ("TCP_KEEPALIVE", 60),
        ("TCP_KEEPINTVL", 30),
        ("TCP_KEEPCNT", 3),
    )
    if hasattr(socket, name)
}

type ProcessName = Literal["app", "rate-limit", "worker", "script"]


def create_redis(process_name: ProcessName) -> Redis:
    return FailoverRedis.from_url(
        settings.redis_url,
        decode_responses=True,
        retry_on_error=REDIS_RETRY_ON_ERRROR,
        retry=REDIS_RETRY,
        client_name=f"{settings.ENV.value}.{process_name}",
        socket_keepalive=True,
        socket_keepalive_options=REDIS_KEEPALIVE_OPTIONS,
        health_check_interval=30,
    )


async def get_redis(request: Request) -> Redis:
    return request.state.redis


__all__ = [
    "REDIS_RETRY",
    "REDIS_RETRY_ON_ERRROR",
    "FailoverRedis",
    "Redis",
    "SyncFailoverRedis",
    "create_redis",
    "get_redis",
]
