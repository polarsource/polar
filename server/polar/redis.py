import socket
from typing import Any, Literal

import redis as _sync_redis
import redis.asyncio as _async_redis
from fastapi.requests import HTTPConnection
from redis import ConnectionError, ReadOnlyError, RedisError, TimeoutError
from redis.asyncio.retry import Retry
from redis.backoff import default_backoff

from polar.config import settings

Redis = _async_redis.Redis
_Pipeline = _async_redis.client.Pipeline
_SyncRedis = _sync_redis.Redis
_SyncPipeline = _sync_redis.client.Pipeline


# A demoted primary answers READONLY until DNS flips; dropping idle connections on
# the first one (via redis-py's per-attempt failure hooks) makes the whole pool
# re-resolve while the command keeps retrying, without surfacing an error.


class FailoverPipeline(_Pipeline):
    async def _disconnect_raise_on_watching(
        self,
        conn: Any,
        error: Exception,
        failure_count: int | None = None,
        start_time: float | None = None,
        command_name: str | None = None,
    ) -> None:
        if isinstance(error, ReadOnlyError):
            await self.connection_pool.disconnect(inuse_connections=False)
        await super()._disconnect_raise_on_watching(
            conn, error, failure_count, start_time, command_name
        )


class FailoverRedis(Redis):
    async def _close_connection(
        self,
        conn: Any,
        error: BaseException | None = None,
        failure_count: int | None = None,
        start_time: float | None = None,
        command_name: str | None = None,
    ) -> None:
        if isinstance(error, ReadOnlyError):
            await self.connection_pool.disconnect(inuse_connections=False)
        await super()._close_connection(
            conn, error, failure_count, start_time, command_name
        )

    def pipeline(
        self, transaction: bool = True, shard_hint: str | None = None
    ) -> _Pipeline:
        return FailoverPipeline(
            self.connection_pool, self.response_callbacks, transaction, shard_hint
        )


class SyncFailoverPipeline(_SyncPipeline):
    def _disconnect_raise_on_watching(
        self,
        conn: Any,
        error: Exception,
        failure_count: int | None = None,
        start_time: float | None = None,
        command_name: str | None = None,
    ) -> None:
        if isinstance(error, ReadOnlyError):
            self.connection_pool.disconnect(inuse_connections=False)
        super()._disconnect_raise_on_watching(
            conn, error, failure_count, start_time, command_name
        )


class SyncFailoverRedis(_SyncRedis):
    def _close_connection(
        self,
        conn: Any,
        error: Exception | None = None,
        failure_count: int | None = None,
        start_time: float | None = None,
        command_name: str | None = None,
    ) -> None:
        if isinstance(error, ReadOnlyError):
            self.connection_pool.disconnect(inuse_connections=False)
        super()._close_connection(conn, error, failure_count, start_time, command_name)

    def pipeline(
        self, transaction: bool = True, shard_hint: str | None = None
    ) -> _SyncPipeline:
        return SyncFailoverPipeline(
            self.connection_pool, self.response_callbacks, transaction, shard_hint
        )


REDIS_RETRY_ON_ERRROR: list[type[RedisError]] = [
    ConnectionError,
    ReadOnlyError,
    TimeoutError,
]
REDIS_RETRY = Retry(default_backoff(), retries=50)

# RESP2 keeps Lua booleans as 1/nil for our and dramatiq's scripts; the pool is
# unbounded because each eventstream subscriber holds a connection.
REDIS_CONNECTION_OPTIONS: dict[str, Any] = {"protocol": 2, "max_connections": 2**31}

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
        socket_timeout=10,
        socket_connect_timeout=3,
        socket_keepalive=True,
        socket_keepalive_options=REDIS_KEEPALIVE_OPTIONS,
        health_check_interval=30,
        **REDIS_CONNECTION_OPTIONS,
    )


async def get_redis(connection: HTTPConnection) -> Redis:
    return connection.state.redis


__all__ = [
    "REDIS_CONNECTION_OPTIONS",
    "REDIS_RETRY",
    "REDIS_RETRY_ON_ERRROR",
    "FailoverRedis",
    "Redis",
    "SyncFailoverRedis",
    "create_redis",
    "get_redis",
]
