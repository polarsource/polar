from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from polar.config import settings
from polar.exceptions import PolarError
from polar.routing import APIRouter

from .endpoints import redirect


async def redirect_to_frontend(request: Request, exc: Exception) -> RedirectResponse:
    """Redirect all errors to frontend base URL."""
    return RedirectResponse(settings.FRONTEND_BASE_URL, status_code=302)


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# Handle errors by redirecting to frontend:
# - StarletteHTTPException: Unmatched routes (e.g., /a/b/c)
# - PolarError: Invalid secrets (ResourceNotFound)
app.add_exception_handler(StarletteHTTPException, redirect_to_frontend)
app.add_exception_handler(PolarError, redirect_to_frontend)

router = APIRouter()
router.get("/{client_secret}")(redirect)


@router.get("/")
async def root() -> RedirectResponse:
    """Redirect root path to frontend."""
    return RedirectResponse(settings.FRONTEND_BASE_URL, status_code=302)


app.include_router(router)
