from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from polar.config import settings
from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.routing import TransactionalAPIRoute, get_api_router_class

from .endpoints import redirect


async def redirect_to_frontend(request: Request, exc: Exception) -> RedirectResponse:
    """Redirect all errors to frontend base URL."""
    return RedirectResponse(settings.FRONTEND_BASE_URL, status_code=302)


async def redirect_to_frontend_not_found(
    request: Request, exc: Exception
) -> RedirectResponse:
    """Redirect unknown checkout links to the frontend 404 page."""
    return RedirectResponse(settings.generate_frontend_url("/404"), status_code=302)


router = get_api_router_class(TransactionalAPIRoute)()
router.get("/{client_secret}")(redirect)

app = FastAPI(
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    exception_handlers={
        StarletteHTTPException: redirect_to_frontend,
        ResourceNotFound: redirect_to_frontend_not_found,
        PolarError: redirect_to_frontend,
    },
)
app.include_router(router)
