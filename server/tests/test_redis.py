from unittest.mock import AsyncMock, MagicMock

import pytest
from redis import ConnectionError, ReadOnlyError

from polar.redis import (
    FailoverPipeline,
    FailoverRedis,
    SyncFailoverPipeline,
    SyncFailoverRedis,
)


def create_async_client() -> FailoverRedis:
    client = FailoverRedis()
    client.connection_pool = AsyncMock()
    return client


def create_sync_client() -> SyncFailoverRedis:
    client = SyncFailoverRedis()
    client.connection_pool = MagicMock()
    return client


@pytest.mark.asyncio
class TestFailoverRedis:
    async def test_readonly_drops_idle_connections(self) -> None:
        client = create_async_client()
        try:
            raise ReadOnlyError("READONLY")
        except ReadOnlyError:
            await client._close_connection(AsyncMock())

        client.connection_pool.disconnect.assert_awaited_once_with(
            inuse_connections=False
        )

    async def test_other_errors_leave_pool_alone(self) -> None:
        client = create_async_client()
        try:
            raise ConnectionError("connection lost")
        except ConnectionError:
            await client._close_connection(AsyncMock())

        client.connection_pool.disconnect.assert_not_awaited()

    async def test_pipeline_returns_failover_pipeline(self) -> None:
        client = create_async_client()
        assert isinstance(client.pipeline(), FailoverPipeline)

    async def test_pipeline_readonly_drops_idle_connections(self) -> None:
        client = create_async_client()
        pipeline = client.pipeline()
        assert isinstance(pipeline, FailoverPipeline)
        pipeline.watching = False

        await pipeline._disconnect_raise_on_watching(
            AsyncMock(), ReadOnlyError("READONLY")
        )

        client.connection_pool.disconnect.assert_awaited_once_with(
            inuse_connections=False
        )


class TestSyncFailoverRedis:
    def test_readonly_drops_idle_connections(self) -> None:
        client = create_sync_client()
        try:
            raise ReadOnlyError("READONLY")
        except ReadOnlyError:
            client._close_connection(MagicMock())

        client.connection_pool.disconnect.assert_called_once_with(
            inuse_connections=False
        )

    def test_other_errors_leave_pool_alone(self) -> None:
        client = create_sync_client()
        try:
            raise ConnectionError("connection lost")
        except ConnectionError:
            client._close_connection(MagicMock())

        client.connection_pool.disconnect.assert_not_called()

    def test_pipeline_returns_failover_pipeline(self) -> None:
        client = create_sync_client()
        assert isinstance(client.pipeline(), SyncFailoverPipeline)

    def test_pipeline_readonly_drops_idle_connections(self) -> None:
        client = create_sync_client()
        pipeline = client.pipeline()
        assert isinstance(pipeline, SyncFailoverPipeline)
        pipeline.watching = False

        pipeline._disconnect_raise_on_watching(MagicMock(), ReadOnlyError("READONLY"))

        client.connection_pool.disconnect.assert_called_once_with(
            inuse_connections=False
        )
