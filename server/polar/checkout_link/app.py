from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from polar.config import settings
from polar.exceptions import PolarError

from .endpoints import redirect


async def redirect_to_frontend(request: Request, exc: Exception) -> RedirectResponse:
    """Redirect all errors to frontend base URL."""
    return RedirectResponse(settings.FRONTEND_BASE_URL, status_code=302)


app = FastAPI(
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    exception_handlers={
        StarletteHTTPException: redirect_to_frontend,
        PolarError: redirect_to_frontend,
    },
)

app.get("/{client_secret}")(redirect)
