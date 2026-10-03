import socket

from sse_starlette.sse import AppStatus
from uvicorn import Server


def install_sse_shutdown_hook() -> None:
    """
    Flag sse_starlette's `AppStatus.should_exit` as soon as Uvicorn starts
    shutting down, so open SSE streams close instead of holding the process
    until `--timeout-graceful-shutdown` expires.

    sse_starlette only detects shutdowns triggered by a signal. When Uvicorn
    stops on its own after `--limit-max-requests`, nothing tells the streams.
    """
    shutdown = Server.shutdown

    async def _shutdown(
        self: Server, sockets: list[socket.socket] | None = None
    ) -> None:
        AppStatus.should_exit = True
        await shutdown(self, sockets)

    Server.shutdown = _shutdown  # type: ignore[method-assign]
