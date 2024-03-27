import typing

from authlib.oauth2.rfc6749 import JsonRequest, OAuth2Request
from starlette.requests import Request

from polar.models import User


class AuthenticatedRequestMixin:
    _request: Request

    @property
    def user(self) -> User | None:
        return self._request.state.user


class StarletteOAuth2Request(AuthenticatedRequestMixin, OAuth2Request):
    def __init__(self, request: Request):
        super().__init__(
            request.method, str(request.url), request._form, request.headers
        )
        self._request = request

    @property
    def args(self) -> dict[str, str]:
        return dict(self._request.query_params)


class StarletteJsonRequest(AuthenticatedRequestMixin, JsonRequest):
    def __init__(self, request: Request):
        super().__init__(request.method, request.url, None, request.headers)
        self._request = request

    @property
    def data(self) -> typing.Any:
        return self._request._json
