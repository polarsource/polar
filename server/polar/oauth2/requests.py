import typing
from collections import defaultdict

from authlib.oauth2.rfc6749 import (
    JsonPayload,
    JsonRequest,
    OAuth2Payload,
    OAuth2Request,
)
from starlette.datastructures import URL, ImmutableMultiDict, UploadFile
from starlette.requests import Request


class RequestPathParamsMixin:
    _request: Request

    @property
    def path_params(self) -> dict[str, typing.Any]:
        return self._request.path_params


class StarletteOAuth2Payload(OAuth2Payload):
    def __init__(self, request: Request) -> None:
        # Merge query parameters and form data into a single dictionary
        datalist = defaultdict(list)
        sources: list[ImmutableMultiDict[str, str | UploadFile]] = [
            request.query_params
        ]
        if request._form is not None:
            sources.append(request._form)
        for source in sources:
            for key, value in source.multi_items():
                if not isinstance(value, UploadFile):
                    datalist[key].append(value)
        self._datalist: dict[str, list[str]] = dict(datalist)
        self._data = {k: v[0] for k, v in self._datalist.items()}

    @property
    def data(self) -> dict[str, str]:
        return self._data

    @property
    def datalist(self) -> dict[str, list[str]]:
        return self._datalist


class StarletteOAuth2Request(RequestPathParamsMixin, OAuth2Request):
    def __init__(self, request: Request):
        super().__init__(request.method, str(request.url), headers=request.headers)
        self.user = getattr(request.state, "user", None)
        self.payload = StarletteOAuth2Payload(request)
        self._args = dict(request.query_params)
        self._form = dict(request._form) if request._form else {}

    @property
    def args(self) -> dict[str, str | None]:
        return typing.cast(dict[str, str | None], self._args)

    @property
    def form(self) -> dict[str, str]:
        return typing.cast(dict[str, str], self._form)


class StarletteJsonPayload(JsonPayload):
    def __init__(self, request: Request) -> None:
        self._data = getattr(request.state, "parsed_data", None)

    @property
    def data(self) -> dict[str, str]:
        return self._data or {}


class StarletteJsonRequest(RequestPathParamsMixin, JsonRequest):
    credential: str | None = None

    def __init__(self, request: Request):
        super().__init__(request.method, str(request.url), request.headers)
        self.user = getattr(request.state, "user", None)
        self.payload = StarletteJsonPayload(request)
        self._request = request

    def url_for(self, name: str, /, **path_params: typing.Any) -> URL:
        return self._request.url_for(name, **path_params)
