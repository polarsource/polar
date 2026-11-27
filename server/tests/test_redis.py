import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock, Mock

import pytest
from redis import ConnectionError, ReadOnlyError
from redis.backoff import NoBackoff
from redis.retry import Retry

from polar.redis import (
    FailoverPipeline,
    FailoverRedis,
    SyncFailoverPipeline,
    SyncFailoverRedis,
)

FAILURE: dict[str, Any] = {
    "failure_count": 1,
    "start_time": time.monotonic(),
    "command_name": "SET",
}


def create_connection(mock: type[Mock]) -> Mock:
    connection = mock()
    connection.retry = Retry(NoBackoff(), retries=3)
    return connection


def create_async_client() -> tuple[FailoverRedis, AsyncMock]:
    client = FailoverRedis()
    pool = AsyncMock()
    client.connection_pool = pool
    return client, pool


def create_sync_client() -> tuple[SyncFailoverRedis, MagicMock]:
    client = SyncFailoverRedis()
    pool = MagicMock()
    client.connection_pool = pool
    return client, pool


@pytest.mark.anyio
class TestFailoverRedis:
    async def test_readonly_drops_idle_connections(self) -> None:
        client, pool = create_async_client()

        await client._close_connection(
            create_connection(AsyncMock), ReadOnlyError("READONLY"), **FAILURE
        )

        pool.disconnect.assert_awaited_once_with(inuse_connections=False)

    async def test_other_errors_leave_pool_alone(self) -> None:
        client, pool = create_async_client()

        await client._close_connection(
            create_connection(AsyncMock), ConnectionError("connection lost"), **FAILURE
        )

        pool.disconnect.assert_not_awaited()

    async def test_pipeline_returns_failover_pipeline(self) -> None:
        client, _ = create_async_client()
        assert isinstance(client.pipeline(), FailoverPipeline)

    async def test_pipeline_readonly_drops_idle_connections(self) -> None:
        client, pool = create_async_client()
        pipeline = client.pipeline()
        assert isinstance(pipeline, FailoverPipeline)
        pipeline.watching = False

        await pipeline._disconnect_raise_on_watching(
            create_connection(AsyncMock), ReadOnlyError("READONLY"), **FAILURE
        )

        pool.disconnect.assert_awaited_once_with(inuse_connections=False)

    async def test_pipeline_watch_readonly_drops_idle_connections(self) -> None:
        client, pool = create_async_client()
        pipeline = client.pipeline()
        assert isinstance(pipeline, FailoverPipeline)
        pipeline.watching = False

        await pipeline._disconnect_reset_raise_on_watching(
            create_connection(AsyncMock), ReadOnlyError("READONLY"), **FAILURE
        )

        pool.disconnect.assert_awaited_once_with(inuse_connections=False)

    async def test_pipeline_watch_other_errors_leave_pool_alone(self) -> None:
        client, pool = create_async_client()
        pipeline = client.pipeline()
        assert isinstance(pipeline, FailoverPipeline)
        pipeline.watching = False

        await pipeline._disconnect_reset_raise_on_watching(
            create_connection(AsyncMock), ConnectionError("connection lost"), **FAILURE
        )

        pool.disconnect.assert_not_awaited()


class TestSyncFailoverRedis:
    def test_readonly_drops_idle_connections(self) -> None:
        client, pool = create_sync_client()

        client._close_connection(
            create_connection(MagicMock), ReadOnlyError("READONLY"), **FAILURE
        )

        pool.disconnect.assert_called_once_with(inuse_connections=False)

    def test_other_errors_leave_pool_alone(self) -> None:
        client, pool = create_sync_client()

        client._close_connection(
            create_connection(MagicMock), ConnectionError("connection lost"), **FAILURE
        )

        pool.disconnect.assert_not_called()

    def test_pipeline_returns_failover_pipeline(self) -> None:
        client, _ = create_sync_client()
        assert isinstance(client.pipeline(), SyncFailoverPipeline)

    def test_pipeline_readonly_drops_idle_connections(self) -> None:
        client, pool = create_sync_client()
        pipeline = client.pipeline()
        assert isinstance(pipeline, SyncFailoverPipeline)
        pipeline.watching = False

        pipeline._disconnect_raise_on_watching(
            create_connection(MagicMock), ReadOnlyError("READONLY"), **FAILURE
        )

        pool.disconnect.assert_called_once_with(inuse_connections=False)

    def test_pipeline_watch_readonly_drops_idle_connections(self) -> None:
        client, pool = create_sync_client()
        pipeline = client.pipeline()
        assert isinstance(pipeline, SyncFailoverPipeline)
        pipeline.watching = False

        pipeline._disconnect_reset_raise_on_watching(
            create_connection(MagicMock), ReadOnlyError("READONLY"), **FAILURE
        )

        pool.disconnect.assert_called_once_with(inuse_connections=False)

    def test_pipeline_watch_other_errors_leave_pool_alone(self) -> None:
        client, pool = create_sync_client()
        pipeline = client.pipeline()
        assert isinstance(pipeline, SyncFailoverPipeline)
        pipeline.watching = False

        pipeline._disconnect_reset_raise_on_watching(
            create_connection(MagicMock), ConnectionError("connection lost"), **FAILURE
        )

        pool.disconnect.assert_not_called()
