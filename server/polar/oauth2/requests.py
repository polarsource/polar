import typing

from authlib.oauth2.rfc6749 import JsonRequest, OAuth2Request
from starlette.requests import Request


class RequestPathParamsMixin:
    _request: Request

    @property
    def path_params(self) -> dict[str, typing.Any]:
        return self._request.path_params


class StarletteOAuth2Request(RequestPathParamsMixin, OAuth2Request):
    def __init__(self, request: Request):
        super().__init__(
            request.method, str(request.url), request._form, request.headers
        )
        self.user = getattr(request.state, "user", None)
        self._request = request

    @property
    def args(self) -> dict[str, str]:
        return dict(self._request.query_params)


class StarletteJsonRequest(RequestPathParamsMixin, JsonRequest):
    def __init__(self, request: Request):
        super().__init__(request.method, request.url, None, request.headers)
        self.user = getattr(request.state, "user", None)
        self._request = request

    @property
    def data(self) -> typing.Any:
        return self._request._json
