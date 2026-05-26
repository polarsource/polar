from urllib.parse import urlencode

from fastapi import Request, Response
from fastapi.responses import RedirectResponse

from polar.config import settings

from .exceptions import PolarAuthRedirectionError


async def auth_redirection_error_exception_handler(
    request: Request, exc: PolarAuthRedirectionError
) -> Response:
    error_url_params = urlencode({"error": exc.message})
    error_url = f"{settings.generate_frontend_url('/auth')}?{error_url_params}"
    return RedirectResponse(error_url, 303)


__all__ = ["PolarAuthRedirectionError", "auth_redirection_error_exception_handler"]
