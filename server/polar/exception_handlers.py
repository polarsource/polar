from urllib.parse import urlencode

from fastapi import Request
from fastapi.responses import JSONResponse, RedirectResponse

from polar.config import settings
from polar.exceptions import PolarError, PolarRedirectionError


async def polar_exception_handler(request: Request, exc: PolarError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"type": type(exc).__name__, "detail": exc.message},
    )


async def polar_redirection_exception_handler(
    request: Request, exc: PolarRedirectionError
) -> RedirectResponse:
    error_url_params = urlencode(
        {
            "message": exc.message,
            "goto_url": exc.goto_url
            or settings.generate_frontend_url(
                settings.FRONTEND_DEFAULT_REDIRECTION_PATH
            ),
        }
    )
    error_url = f"{settings.generate_frontend_url("/error")}?{error_url_params}"
    return RedirectResponse(error_url, 303)
