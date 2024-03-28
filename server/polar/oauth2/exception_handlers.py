import json

from authlib.oauth2 import OAuth2Error
from fastapi import Request, Response


async def oauth2_error_exception_handler(
    request: Request, exc: OAuth2Error
) -> Response:
    status_code, body, headers = exc()
    if isinstance(body, dict):
        body = json.dumps(body)
    return Response(body, status_code=status_code, headers={k: v for k, v in headers})


__all__ = ["oauth2_error_exception_handler", "OAuth2Error"]
