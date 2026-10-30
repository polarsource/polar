import json
from typing import overload

from authlib.oauth2 import OAuth2Error
from fastapi import Request, Response, WebSocket
from fastapi.requests import HTTPConnection


@overload
async def oauth2_error_exception_handler(
    connection: Request, exc: Exception
) -> Response: ...


@overload
async def oauth2_error_exception_handler(
    connection: WebSocket, exc: Exception
) -> None: ...


@overload
async def oauth2_error_exception_handler(
    connection: HTTPConnection, exc: Exception
) -> Response | None: ...


async def oauth2_error_exception_handler(
    connection: HTTPConnection, exc: Exception
) -> Response | None:
    assert isinstance(exc, OAuth2Error)
    status_code, body, headers = exc()
    if isinstance(body, dict):
        body = json.dumps(body)
    response = Response(
        body, status_code=status_code, headers={k: v for k, v in headers}
    )
    if isinstance(connection, WebSocket):
        await connection.send_denial_response(response)
        return None
    return response


__all__ = ["OAuth2Error", "oauth2_error_exception_handler"]
