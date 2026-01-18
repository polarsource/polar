from collections.abc import Mapping
from typing import Any

from fastapi.datastructures import URL
from fastapi.requests import Request
from fastapi.responses import HTMLResponse, RedirectResponse
from markupflow import Fragment
from starlette.background import BackgroundTask
from starlette.types import Receive, Scope, Send

from .toast import render_toasts


class TagResponse(HTMLResponse):
    """
    HTML response that renders Fragment/Document instances and supports toast rendering.
    """

    def __init__(
        self,
        content: Fragment | None = None,
        status_code: int = 200,
        headers: Mapping[str, str] | None = None,
        media_type: str | None = None,
        background: BackgroundTask | None = None,
    ) -> None:
        self.status_code = status_code
        if media_type is not None:
            self.media_type = media_type
        self.background = background
        self.fragment_content = content
        self.initial_headers = headers
        super().__init__(content="", status_code=status_code, headers=headers, media_type=media_type, background=background)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Render toasts into the fragment
        if self.fragment_content is not None:
            with render_toasts(scope, self.fragment_content):
                pass
            self.body = self.fragment_content.render().encode("utf-8")
        else:
            self.body = b""
        
        # Reinitialize headers in case they were modified
        if self.initial_headers is not None:
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
