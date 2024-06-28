import functools
import re

import structlog
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from polar.config import settings
from polar.logging import Logger, generate_correlation_id
from polar.worker import flush_enqueued_jobs


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


class XForwardedHostMiddleware:
    """
    Ensures the app respects the `X-Forwarded-Host` if correctly trusted.

    Necessary to make `.url_for` correctly working behind a proxy.

    Should not be necessary anymore when Uvicorn releases this:
    https://github.com/encode/uvicorn/pull/2231
    """

    def __init__(self, app: ASGIApp, trusted_hosts: str | list[str] = "127.0.0.1"):
        self.app = app
        if isinstance(trusted_hosts, str):
            self.trusted_hosts = {item.strip() for item in trusted_hosts.split(",")}
        else:
            self.trusted_hosts = set(trusted_hosts)
        self.always_trust = "*" in self.trusted_hosts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket"):
            client_addr: tuple[str, int] | None = scope.get("client")
            client_host = client_addr[0] if client_addr else None

            if self.always_trust or client_host in self.trusted_hosts:
                headers = MutableHeaders(scope=scope)

                if "x-forwarded-host" in headers:
                    headers.update({"host": headers["x-forwarded-host"]})
                    scope["headers"] = headers.raw

        return await self.app(scope, receive, send)


class FlushEnqueuedWorkerJobsMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        await self.app(scope, receive, send)

        if not settings.is_testing():
            await flush_enqueued_jobs(scope["state"]["arq_pool"])


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
