import json

from authlib.oauth2 import OAuth2Error
from fastapi import Response
from fastapi.requests import HTTPConnection


async def oauth2_error_exception_handler(
    connection: HTTPConnection, exc: Exception
) -> Response:
    assert isinstance(exc, OAuth2Error)
    status_code, body, headers = exc()
    if isinstance(body, dict):
        body = json.dumps(body)
    return Response(body, status_code=status_code, headers={k: v for k, v in headers})


__all__ = ["OAuth2Error", "oauth2_error_exception_handler"]
