import builtins
import collections.abc
import types
import typing

import adaptix
import adaptix.load_error
import httpx
import typing_extensions

_EnvironmentT = typing.TypeVar("_EnvironmentT", bound=str)
_ModelT = typing.TypeVar("_ModelT")
RequestTimeout: typing.TypeAlias = float | httpx.Timeout


class PolarError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class PolarNetworkError(PolarError):
    def __init__(self, message: str):
        super().__init__(f"Polar API network error: {message}")


class PolarServerError(PolarError):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(
            f"Polar API returned a server error: {status_code} - {message}"
        )


class PolarDeserializationError(PolarError):
    def __init__(self, error: adaptix.load_error.LoadError):
        self.error = error
        super().__init__(f"Failed to deserialize data: {error}")


class PolarClientError(PolarError):
    error_type: typing.ClassVar[typing.Any]
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any):
        self.status_code = status_code
        self.error = error
        super().__init__(f"Polar API returned an error: {status_code} - {error}")


class PolarRateLimitError(PolarClientError):
    error_type = None

    def __init__(
        self, status_code: typing.Literal[429], retry_after: int | None = None
    ):
        super().__init__(status_code, "Rate limit exceeded")
        self.retry_after = retry_after


def resolve_base_url(
    servers: collections.abc.Mapping[_EnvironmentT, str],
    environment: _EnvironmentT,
    base_url: str | None,
) -> str:
    if base_url is not None:
        return base_url
    try:
        return servers[environment]
    except KeyError as e:
        environments = ", ".join(sorted(servers))
        raise ValueError(
            f"Invalid environment {environment!r}. Expected one of: {environments}."
        ) from e


class BuildRequestMixin:
    def build_request(
        self: "SyncClientBase | AsyncClientBase",
        method: str,
        url: str,
        path_params: dict[str, typing.Any] | None = None,
        query_params: dict[str, typing.Any] | None = None,
        body: typing.Any | None = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> httpx.Request:
        url = url.format(**(path_params or {}))

        params: dict[str, typing.Any] = {}
        for k, v in (query_params or {}).items():
            if v is None:
                continue
            if isinstance(v, dict):
                for sub_k, sub_v in v.items():
                    params[f"{k}[{sub_k}]"] = sub_v
            else:
                params[k] = v

        timeout = self._client.timeout if request_timeout is None else request_timeout
        headers: dict[str, str] | None = None
        if request_access_token is not None:
            headers = {"Authorization": f"Bearer {request_access_token}"}
        return self._client.build_request(
            method, url, params=params, json=body, timeout=timeout, headers=headers
        )


class SyncClientBase(BuildRequestMixin):
    def __init__(
        self,
        base_url: str,
        version: str,
        access_token: str,
        timeout: RequestTimeout | None = 5.0,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url,
            timeout=timeout,
            headers={
                "Polar-Version": version,
                "Authorization": f"Bearer {access_token}",
            },
        )

    def __enter__(self) -> typing.Self:
        self._client.__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        self._client.__exit__(exc_type, exc_val, exc_tb)

    def send_request(self, request: httpx.Request) -> httpx.Response:
        try:
            return self._client.send(request)
        except httpx.RequestError as e:
            raise PolarNetworkError(str(e)) from e


class AsyncClientBase(BuildRequestMixin):
    def __init__(
        self,
        base_url: str,
        version: str,
        access_token: str,
        timeout: RequestTimeout | None = 5.0,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            headers={
                "Polar-Version": version,
                "Authorization": f"Bearer {access_token}",
            },
        )

    async def __aenter__(self) -> typing.Self:
        await self._client.__aenter__()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        await self._client.__aexit__(exc_type, exc_val, exc_tb)

    async def send_request(self, request: httpx.Request) -> httpx.Response:
        try:
            return await self._client.send(request)
        except httpx.RequestError as e:
            raise PolarNetworkError(str(e)) from e


class SyncServiceBase:
    def __init__(self, client: SyncClientBase):
        self.client = client

    @classmethod
    def from_service(cls, service: "SyncServiceBase") -> typing.Self:
        return cls(service.client)


class AsyncServiceBase:
    def __init__(self, client: AsyncClientBase):
        self.client = client

    @classmethod
    def from_service(cls, service: "AsyncServiceBase") -> typing.Self:
        return cls(service.client)


def _load_exact_float(data: object) -> float:
    if type(data) is float:
        return data
    raise adaptix.load_error.TypeLoadError(float, data)


# Adaptix's float loader also accepts int, and union cases are tried in an
# order that puts float first, so int | float would always coerce to float.
# P[Union][float] targets float only as a member of that union (not standalone
# float fields, which should still coerce JSON ints).
_retort = adaptix.Retort(
    recipe=[
        adaptix.loader(
            adaptix.P[int | float][float]
            | adaptix.P[int | float | None][float]
            | adaptix.P[str | int | float | bool][float],
            _load_exact_float,
        ),
    ]
)


def _register_extra_items_typed_dict(
    model: typing.Any,
    extra_items_type: typing_extensions.TypeForm[typing.Any],
) -> None:
    global _retort

    field_types = typing.get_type_hints(model, include_extras=True)
    required_keys = set(model.__required_keys__)
    for key, field_type in field_types.items():
        field_origin = typing.get_origin(field_type)
        if field_origin is typing.Required:
            required_keys.add(key)
        elif field_origin is typing.NotRequired:
            required_keys.discard(key)
        if field_origin in (typing.Required, typing.NotRequired):
            field_types[key] = typing.get_args(field_type)[0]

    def load_extra_items_typed_dict(data: object) -> dict[str, typing.Any]:
        if not isinstance(data, collections.abc.Mapping):
            raise adaptix.load_error.TypeLoadError(collections.abc.Mapping, data)

        missing_keys = required_keys - data.keys()
        if missing_keys:
            raise adaptix.load_error.NoRequiredFieldsLoadError(missing_keys, data)

        loaded: dict[str, typing.Any] = {}
        for key, value in data.items():
            if not isinstance(key, str):
                raise adaptix.load_error.TypeLoadError(str, key)
            if key in field_types:
                loaded[key] = _retort.load(value, field_types[key])
            else:
                loaded[key] = _retort.load(value, extra_items_type)
        return loaded

    _retort = _retort.extend(
        recipe=[adaptix.loader(model, load_extra_items_typed_dict)]
    )


def deserialize(data: object, model: typing_extensions.TypeForm[_ModelT]) -> _ModelT:
    try:
        return typing.cast(_ModelT, _retort.load(data, model))
    except adaptix.load_error.LoadError as e:
        raise PolarDeserializationError(e) from e


E = typing.TypeVar("E", bound=PolarClientError)


def _handle_errors(
    response: httpx.Response,
    errors: dict[int, type[E]] | None = None,
) -> None:
    status_code = response.status_code

    if response.is_server_error:
        raise PolarServerError(status_code, response.text)

    if response.is_client_error:
        if status_code == 429:
            retry_after = response.headers.get("Retry-After")
            raise PolarRateLimitError(
                429, int(retry_after) if retry_after is not None else None
            )
        try:
            error_class = (errors or {})[status_code]
            match error_class.error_type:
                case None:
                    raise error_class(status_code, None)
                case builtins.str:
                    raise error_class(status_code, response.text)
                case _:
                    raise error_class(
                        status_code,
                        deserialize(response.json(), error_class.error_type),
                    )
        except KeyError:
            raise PolarClientError(status_code, response.text)


def parse_response_json(
    response: httpx.Response,
    response_model: typing.Any | None = None,
    errors: dict[int, type[E]] | None = None,
) -> typing.Any:
    _handle_errors(response, errors)

    if response_model is not None:
        return deserialize(response.json(), response_model)

    return response.json()


def parse_response_text(
    response: httpx.Response,
    errors: dict[int, type[E]] | None = None,
) -> str:
    _handle_errors(response, errors)
    return response.text


def parse_response_none(
    response: httpx.Response,
    errors: dict[int, type[E]] | None = None,
) -> None:
    _handle_errors(response, errors)
