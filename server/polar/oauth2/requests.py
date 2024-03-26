import typing

from authlib.oauth2.rfc6749 import JsonRequest, OAuth2Request
from starlette.requests import Request

from polar.models import User


class StarletteOAuth2Request(OAuth2Request):
    user: User | None

    def __init__(self, request: Request):
        super().__init__(
            request.method, str(request.url), request._form, request.headers
        )
        self._request = request

    @property
    def args(self) -> dict[str, str]:
        return dict(self._request.query_params)


class StarletteJsonRequest(JsonRequest):
    def __init__(self, request: Request):
        super().__init__(request.method, request.url, None, request.headers)
        self._request = request

    @property
    def data(self) -> typing.Any:
        return self._request._json
