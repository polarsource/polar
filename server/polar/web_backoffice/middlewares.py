import functools

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send
from tagflow import document


class TagflowMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        with document():
            await self.app(scope, receive, send)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        send = functools.partial(self.send, send=send)
        await self.app(scope, receive, send)

    async def send(self, message: Message, send: Send) -> None:
        if message["type"] != "http.response.start":
            await send(message)
            return

        message.setdefault("headers", [])
        headers = MutableHeaders(scope=message)

        # Add Content-Security-Policy
        # Restricts sources of content to only the same origin, but allows inline CSS and data:image
        headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
        )

        # Add X-Content-Type-Options
        # Prevents MIME type sniffing
        headers["X-Content-Type-Options"] = "nosniff"

        # Add X-Frame-Options
        # Prevents your site from being framed by other sites
        headers["X-Frame-Options"] = "DENY"

        # Add Referrer-Policy
        # Controls what information is sent in the Referer header
        headers["Referrer-Policy"] = "no-referrer"

        # Add Permissions-Policy
        # Restricts which browser features can be used
        headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), interest-cohort=()"
        )

        await send(message)
