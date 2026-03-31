import os
import signal
import subprocess
import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from redis import RedisError
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.routing import Route

import polar.worker._health as health_module
from polar.worker._health import (
    _is_process_alive,
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


class TestIsProcessAlive:
    def test_current_process(self) -> None:
        assert _is_process_alive(os.getpid()) is True

    def test_dead_process(self) -> None:
        assert _is_process_alive(2**30) is False


@pytest.mark.asyncio
class TestHealth:
    async def test_healthy_without_monitored_pid(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        original = health_module._monitored_pid
        health_module._monitored_pid = None
        try:
            response = await health(mock_request)
            assert response.status_code == 200
            mock_redis.ping.assert_called_once()
        finally:
            health_module._monitored_pid = original

    async def test_healthy_with_alive_monitored_pid(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        original = health_module._monitored_pid
        health_module._monitored_pid = os.getpid()
        try:
            response = await health(mock_request)
            assert response.status_code == 200
        finally:
            health_module._monitored_pid = original

    async def test_unhealthy_when_monitored_pid_dead(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        original = health_module._monitored_pid
        health_module._monitored_pid = 2**30
        try:
            with pytest.raises(HTTPException) as exc_info:
                await health(mock_request)
            assert exc_info.value.status_code == 503
            assert "Scheduler process" in str(exc_info.value.detail)
        finally:
            health_module._monitored_pid = original

    async def test_redis_unavailable(
        self, mock_request: MagicMock, mock_redis: AsyncMock
    ) -> None:
        mock_redis.ping.side_effect = RedisError("Connection refused")

        with pytest.raises(HTTPException) as exc_info:
            await health(mock_request)

        assert exc_info.value.status_code == 503
        assert "Redis" in str(exc_info.value.detail)


def _create_test_app() -> Starlette:
    """Create a health app with a mock Redis for integration testing."""
    mock_redis = AsyncMock()
    mock_redis.ping = AsyncMock()

    async def inject_state(request: Request, call_next: Any) -> Any:
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
    """Integration tests that exercise the full Starlette app with process monitoring.

    Uses httpx AsyncClient with ASGITransport to make real HTTP requests
    against the health app, with a real subprocess standing in for the scheduler.
    """

    async def test_healthy_while_scheduler_alive(self) -> None:
        proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        original = health_module._monitored_pid
        health_module._monitored_pid = proc.pid
        try:
            app = _create_test_app()
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/")
                assert response.status_code == 200
                assert response.json() == {"status": "ok"}
        finally:
            health_module._monitored_pid = original
            proc.kill()
            proc.wait()

    async def test_unhealthy_after_scheduler_dies(self) -> None:
        proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        original = health_module._monitored_pid
        health_module._monitored_pid = proc.pid
        try:
            app = _create_test_app()
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # Healthy while alive
                response = await client.get("/")
                assert response.status_code == 200

                # Kill the "scheduler"
                os.kill(proc.pid, signal.SIGKILL)
                proc.wait()

                # Now unhealthy
                response = await client.get("/")
                assert response.status_code == 503
                assert "Scheduler process" in response.text
        finally:
            health_module._monitored_pid = original

    async def test_workers_unaffected_without_monitored_pid(self) -> None:
        """When _monitored_pid is None (regular workers), health is unaffected."""
        original = health_module._monitored_pid
        health_module._monitored_pid = None
        try:
            app = _create_test_app()
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get("/")
                assert response.status_code == 200
        finally:
            health_module._monitored_pid = original
