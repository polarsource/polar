from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from redis import RedisError
from starlette.exceptions import HTTPException

from polar.worker._health import (
    SCHEDULER_HEARTBEAT_KEY,
    SCHEDULER_HEARTBEAT_TTL_SECONDS,
    health,
)


@pytest.fixture
def mock_redis() -> AsyncMock:
    mock = AsyncMock()
    mock.ping = AsyncMock()
    mock.get = AsyncMock(return_value="1")
    return mock


@pytest.fixture
def mock_request(mock_redis: AsyncMock) -> MagicMock:
    req = MagicMock()
    req.state.redis = mock_redis
    return req


@pytest.mark.asyncio
class TestHealth:
    async def test_healthy(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        response = await health(mock_request)

        assert response.status_code == 200
        mock_redis.ping.assert_called_once()
        mock_redis.get.assert_called_once_with(SCHEDULER_HEARTBEAT_KEY)

    async def test_redis_unavailable(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        mock_redis.ping.side_effect = RedisError("Connection refused")

        with pytest.raises(HTTPException) as exc_info:
            await health(mock_request)

        assert exc_info.value.status_code == 503
        assert "Redis" in str(exc_info.value.detail)

    async def test_scheduler_heartbeat_missing(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        mock_redis.get.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await health(mock_request)

        assert exc_info.value.status_code == 503
        assert "Scheduler heartbeat" in str(exc_info.value.detail)


class TestUpdateHeartbeat:
    @patch("polar.worker.scheduler.sync_redis")
    def test_sets_key_with_ttl(self, mock_redis_module: MagicMock) -> None:
        from polar.worker.scheduler import _update_heartbeat

        mock_client = MagicMock()
        mock_redis_module.Redis.from_url.return_value = mock_client

        _update_heartbeat()

        mock_client.set.assert_called_once_with(
            SCHEDULER_HEARTBEAT_KEY, "1", ex=SCHEDULER_HEARTBEAT_TTL_SECONDS
        )
        mock_client.close.assert_called_once()

    @patch("polar.worker.scheduler.sync_redis")
    def test_closes_connection_on_error(self, mock_redis_module: MagicMock) -> None:
        from polar.worker.scheduler import _update_heartbeat

        mock_client = MagicMock()
        mock_client.set.side_effect = RedisError("Connection refused")
        mock_redis_module.Redis.from_url.return_value = mock_client

        with pytest.raises(RedisError):
            _update_heartbeat()

        mock_client.close.assert_called_once()
