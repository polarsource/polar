import structlog
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send

from polar.logging import generate_correlation_id


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
