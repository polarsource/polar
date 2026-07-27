import functools
from urllib.parse import urlsplit

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send
from tagflow import document

from polar.file.s3 import S3_SERVICES
from polar.models.file import FileServiceTypes


@functools.cache
def _content_security_policy() -> str:
    """The backoffice CSP."""
    s3_service = S3_SERVICES[FileServiceTypes.support_case_attachment]
    url, _ = s3_service.generate_presigned_download_url(
        path="csp-origin-probe",
        filename="probe",
        mime_type="application/octet-stream",
    )
    parts = urlsplit(url)
    attachments_origin = f"{parts.scheme}://{parts.netloc}"
    return (
        "default-src 'self'; script-src 'self'; object-src 'none'; "
        "base-uri 'self'; style-src 'self' 'unsafe-inline'; "
        f"img-src 'self' data: {attachments_origin};"
    )


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
        # Restricts sources of content to only the same origin, but allows
        # inline CSS, data:image and presigned attachment images.
        headers["Content-Security-Policy"] = _content_security_policy()

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
