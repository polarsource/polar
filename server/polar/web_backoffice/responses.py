from collections.abc import Mapping
from typing import Any

from fastapi.datastructures import URL
from fastapi.requests import Request
from fastapi.responses import RedirectResponse
from starlette.background import BackgroundTask
from starlette.types import Receive, Scope, Send
from tagflow import TagResponse as _TagResponse

from .toast import render_toasts


class TagResponse(_TagResponse):
    """
    Overload of TagResponse that delays the rendering at call time, so we can render
    the toasts that have been added to the request scope.
    """

    def __init__(
        self,
        content: Any = None,
        status_code: int = 200,
        headers: Mapping[str, str] | None = None,
        media_type: str | None = None,
        background: BackgroundTask | None = None,
    ) -> None:
        self.status_code = status_code
        if media_type is not None:
            self.media_type = media_type
        self.background = background
        self.content = content
        self.initial_headers = headers

        self.init_headers(headers)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        with render_toasts(scope):
            pass
        self.body = self.render(self.content)
        self.init_headers(self.initial_headers)
        await super().__call__(scope, receive, send)


class HXRedirectResponse(RedirectResponse):
    def __init__(
        self,
        request: Request,
        url: str | URL,
        status_code: int = 307,
        headers: dict[str, str] | None = None,
        background: BackgroundTask | None = None,
    ) -> None:
        is_htmx = request.headers.get("HX-Request") == "true"
        status_code = 200 if is_htmx else status_code
        super().__init__(url, status_code, headers, background)
        if is_htmx:
            self.headers["HX-Redirect"] = self.headers["location"]
