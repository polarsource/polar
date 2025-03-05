from fastapi.datastructures import URL
from fastapi.requests import Request
from fastapi.responses import RedirectResponse
from starlette.background import BackgroundTask


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
