from fastapi import Request, Response
from fastapi.responses import RedirectResponse

from polar.kit.http import add_query_parameters

from .exceptions import PolarAuthRedirectionError


async def auth_redirection_error_exception_handler(
    request: Request, exc: Exception
) -> Response:
    assert isinstance(exc, PolarAuthRedirectionError)
    error_url = add_query_parameters(exc.url, error=exc.message, **exc.extra)
    return RedirectResponse(error_url, 303)


__all__ = ["PolarAuthRedirectionError", "auth_redirection_error_exception_handler"]
