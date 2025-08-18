import functools
import re

import dramatiq
import structlog
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from polar.logging import Logger, generate_correlation_id
from polar.worker import JobQueueManager


class LogCorrelationIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        structlog.contextvars.bind_contextvars(
            correlation_id=generate_correlation_id(),
            method=scope["method"],
            path=scope["path"],
        )

        await self.app(scope, receive, send)

        structlog.contextvars.unbind_contextvars("correlation_id", "method", "path")


class FlushEnqueuedWorkerJobsMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        async with JobQueueManager.open(dramatiq.get_broker(), scope["state"]["redis"]):
            await self.app(scope, receive, send)


class PathRewriteMiddleware:
    def __init__(
        self, app: ASGIApp, pattern: str | re.Pattern[str], replacement: str
    ) -> None:
        self.app = app
        self.pattern = pattern
        self.replacement = replacement
        self.logger: Logger = structlog.get_logger()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        scope["path"], replacements = re.subn(
            self.pattern, self.replacement, scope["path"]
        )

        if replacements > 0:
            self.logger.warning(
                "PathRewriteMiddleware",
                pattern=self.pattern,
                replacement=self.replacement,
                path=scope["path"],
            )

        send = functools.partial(self.send, send=send, replacements=replacements)
        await self.app(scope, receive, send)

    async def send(self, message: Message, send: Send, replacements: int) -> None:
        if message["type"] != "http.response.start":
            await send(message)
            return

        message.setdefault("headers", [])
        headers = MutableHeaders(scope=message)
        if replacements > 0:
            headers["X-Polar-Deprecation-Notice"] = (
                "The API root has moved from /api/v1 to /v1. "
                "Please update your integration."
            )

        await send(message)


class SandboxResponseHeaderMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                headers = MutableHeaders(scope=message)
                headers["X-Polar-Sandbox"] = "1"
            await send(message)

        await self.app(scope, receive, send_wrapper)
