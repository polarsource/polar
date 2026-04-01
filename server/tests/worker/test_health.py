import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from redis import RedisError
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

import polar.worker._health as health_module
from polar.worker._health import (
    handle_server_error,
    health,
)


@pytest.fixture
def mock_redis() -> AsyncMock:
    mock = AsyncMock()
    mock.ping = AsyncMock()
    return mock


@pytest.fixture
def mock_request(mock_redis: AsyncMock) -> MagicMock:
    req = MagicMock()
    req.state.redis = mock_redis
    return req


@pytest.mark.asyncio
class TestHealth:
    async def test_healthy_without_heartbeat_checker(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        original = health_module._heartbeat_checker
        health_module._heartbeat_checker = None
        try:
            response = await health(mock_request)
            assert response.status_code == 200
            mock_redis.ping.assert_called_once()
        finally:
            health_module._heartbeat_checker = original

    async def test_healthy_with_passing_checker(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        original = health_module._heartbeat_checker
        health_module._heartbeat_checker = lambda: True
        try:
            response = await health(mock_request)
            assert response.status_code == 200
        finally:
            health_module._heartbeat_checker = original

    async def test_unhealthy_when_checker_fails(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        original = health_module._heartbeat_checker
        health_module._heartbeat_checker = lambda: False
        try:
            with pytest.raises(HTTPException) as exc_info:
                await health(mock_request)
            assert exc_info.value.status_code == 503
            assert "heartbeat" in str(exc_info.value.detail).lower()
        finally:
            health_module._heartbeat_checker = original

    async def test_redis_unavailable(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        mock_redis.ping.side_effect = RedisError("Connection refused")

        with pytest.raises(HTTPException) as exc_info:
            await health(mock_request)

        assert exc_info.value.status_code == 503
        assert "Redis" in str(exc_info.value.detail)


class TestIsSchedulerHealthy:
    def test_healthy_before_first_heartbeat(self) -> None:
        import polar.worker.scheduler as scheduler_module
        from polar.worker.scheduler import _is_scheduler_healthy

        original = scheduler_module._last_heartbeat
        scheduler_module._last_heartbeat = 0.0
        try:
            assert _is_scheduler_healthy() is True
        finally:
            scheduler_module._last_heartbeat = original

    def test_healthy_with_recent_heartbeat(self) -> None:
        import polar.worker.scheduler as scheduler_module
        from polar.worker.scheduler import _is_scheduler_healthy

        original = scheduler_module._last_heartbeat
        scheduler_module._last_heartbeat = time.monotonic()
        try:
            assert _is_scheduler_healthy() is True
        finally:
            scheduler_module._last_heartbeat = original

    def test_unhealthy_with_stale_heartbeat(self) -> None:
        import polar.worker.scheduler as scheduler_module
        from polar.worker.scheduler import (
            HEARTBEAT_STALENESS_SECONDS,
            _is_scheduler_healthy,
        )

        original = scheduler_module._last_heartbeat
        scheduler_module._last_heartbeat = (
            time.monotonic() - HEARTBEAT_STALENESS_SECONDS - 1
        )
        try:
            assert _is_scheduler_healthy() is False
        finally:
            scheduler_module._last_heartbeat = original


def _create_test_app() -> Starlette:
    mock_redis = AsyncMock()
    mock_redis.ping = AsyncMock()

    async def inject_state(request: Request, call_next: Any) -> JSONResponse:
        request.state.redis = mock_redis
        return await call_next(request)

    routes = [Route("/", health, methods=["GET"])]
    app = Starlette(
        routes=routes,
        exception_handlers={Exception: handle_server_error},
    )
    app.add_middleware(BaseHTTPMiddleware, dispatch=inject_state)
    return app


@pytest.mark.asyncio
class TestSchedulerHealthIntegration:
    async def test_healthy_with_passing_checker(self) -> None:
        original = health_module._heartbeat_checker
        health_module._heartbeat_checker = lambda: True
        try:
            app = _create_test_app()
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/")
                assert response.status_code == 200
                assert response.json() == {"status": "ok"}
        finally:
            health_module._heartbeat_checker = original

    async def test_unhealthy_when_checker_fails(self) -> None:
        original = health_module._heartbeat_checker
        health_module._heartbeat_checker = lambda: True
        try:
            app = _create_test_app()
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/")
                assert response.status_code == 200

                health_module._heartbeat_checker = lambda: False

                response = await client.get("/")
                assert response.status_code == 503
                assert "heartbeat" in response.text.lower()
        finally:
            health_module._heartbeat_checker = original

    async def test_workers_unaffected_without_heartbeat_checker(self) -> None:
        original = health_module._heartbeat_checker
        health_module._heartbeat_checker = None
        try:
            app = _create_test_app()
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/")
                assert response.status_code == 200
        finally:
            health_module._heartbeat_checker = original
