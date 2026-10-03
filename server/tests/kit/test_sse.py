from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture
from sse_starlette.sse import AppStatus
from uvicorn import Server

from polar.kit.sse import install_sse_shutdown_hook


@pytest.mark.asyncio
class TestInstallSSEShutdownHook:
    async def test_flags_should_exit_before_shutdown(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(AppStatus, "should_exit", False)
        shutdown = AsyncMock()
        mocker.patch.object(Server, "shutdown", shutdown)
        server = MagicMock(spec=Server)

        install_sse_shutdown_hook()
        await Server.shutdown(server)

        assert AppStatus.should_exit is True
        shutdown.assert_awaited_once_with(server, None)
