from urllib.parse import urlencode

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse

from polar.config import settings
from polar.exceptions import (
    PolarError,
    PolarRedirectionError,
    PolarRequestValidationError,
)


async def polar_exception_handler(request: Request, exc: PolarError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": type(exc).__name__, "detail": exc.message},
        headers=exc.headers,
    )


async def request_validation_exception_handler(
    request: Request, exc: RequestValidationError | PolarRequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": type(exc).__name__, "detail": jsonable_encoder(exc.errors())},
    )


async def polar_redirection_exception_handler(
    request: Request, exc: PolarRedirectionError
) -> RedirectResponse:
    error_url_params = urlencode(
        {
            "message": exc.message,
            "return_to": exc.return_to or settings.FRONTEND_DEFAULT_RETURN_PATH,
        }
    )
    error_url = f"{settings.generate_frontend_url("/error")}?{error_url_params}"
    return RedirectResponse(error_url, 303)


def add_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(
        PolarRedirectionError,
        polar_redirection_exception_handler,  # type: ignore
    )
    app.add_exception_handler(
        RequestValidationError,
        request_validation_exception_handler,  # type: ignore
    )
    app.add_exception_handler(
        PolarRequestValidationError,
        request_validation_exception_handler,  # type: ignore
    )
    app.add_exception_handler(PolarError, polar_exception_handler)  # type: ignore
