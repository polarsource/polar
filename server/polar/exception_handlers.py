from fastapi import Request
from fastapi.responses import JSONResponse

from polar.exceptions import PolarError


async def polar_exception_handler(request: Request, exc: PolarError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"type": type(exc).__name__, "detail": exc.message},
    )
