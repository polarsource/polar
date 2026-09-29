from fastapi import Request, Response
from fastapi.responses import JSONResponse, RedirectResponse

from polar.kit.http import add_query_parameters

from .exceptions import PolarAuthRedirectionError, SSORequired


async def auth_redirection_error_exception_handler(
    request: Request, exc: Exception
) -> Response:
    assert isinstance(exc, PolarAuthRedirectionError)
    error_url = add_query_parameters(exc.url, error=exc.message, **exc.extra)
    return RedirectResponse(error_url, exc.status_code)


async def sso_required_exception_handler(request: Request, exc: Exception) -> Response:
    assert isinstance(exc, SSORequired)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": type(exc).__name__,
            "detail": exc.message,
            "redirect_url": exc.redirect_url,
        },
    )


__all__ = [
    "PolarAuthRedirectionError",
    "SSORequired",
    "auth_redirection_error_exception_handler",
    "sso_required_exception_handler",
]
