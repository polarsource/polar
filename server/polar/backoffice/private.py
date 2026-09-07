import functools
import ipaddress
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, Request, Response
from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from polar.config import settings

from .dependencies import get_admin
from .login import router as login_router
from .versioned_static import VersionedStaticFiles


class TailscaleMiddleware:
    def __init__(self, app: ASGIApp, origin: str) -> None:
        self.app = app
        self.origin = origin
        self.host = urlsplit(origin).netloc

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        client = scope.get("client")
        trusted_peer = bool(client and ipaddress.ip_address(client[0]).is_loopback)
        if (
            not trusted_peer
            or headers.get("host", "").lower() != self.host
            or len(headers.getlist("tailscale-user-login")) != 1
            or not headers.get("tailscale-user-login")
        ):
            await JSONResponse({"detail": "Tailscale user access required"}, 403)(
                scope, receive, send
            )
            return
        if (
            scope["method"] not in {"GET", "HEAD", "OPTIONS"}
            and headers.get("origin") != self.origin
        ):
            await JSONResponse({"detail": "Invalid request origin"}, 403)(
                scope, receive, send
            )
            return

        scope["polar_private_backoffice"] = True
        scope["scheme"] = "https"
        await self.app(scope, receive, functools.partial(self.send, send=send))

    async def send(self, message: Message, send: Send) -> None:
        if message["type"] == "http.response.start":
            headers = MutableHeaders(scope=message)
            headers["Cache-Control"] = "no-store"
            headers["Referrer-Policy"] = "no-referrer"
        await send(message)


def configure_private_backoffice(app: FastAPI, backoffice_app: FastAPI) -> None:
    assert settings.BACKOFFICE_PRIVATE_URL is not None
    app.add_middleware(TailscaleMiddleware, origin=settings.BACKOFFICE_PRIVATE_URL)
    app.include_router(login_router)
    static_files = VersionedStaticFiles(directory=Path(__file__).parent / "static")

    @app.get("/static/{path:path}", name="static", dependencies=[Depends(get_admin)])
    async def static(request: Request, path: str) -> Response:
        return await static_files.get_response(path, request.scope)

    app.mount("/", backoffice_app)
