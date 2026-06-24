from fastapi import Request
from fastapi.responses import Response
from tagflow import tag, text

from polar.exceptions import PolarError

from .layout import layout
from .responses import TagResponse
from .toast import add_toast


async def backoffice_polar_exception_handler(
    request: Request, exc: Exception
) -> Response:
    assert isinstance(exc, PolarError)
    if request.headers.get("HX-Request") == "true":
        await add_toast(request, exc.message, "error")
        return TagResponse(status_code=200)

    with layout(request, [], "index"):
        with tag.div(classes="alert alert-error"):
            text(exc.message)

    return TagResponse(status_code=exc.status_code)
