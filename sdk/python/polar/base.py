import builtins
import collections.abc
import types
import typing

import adaptix
import httpx

_EnvironmentT = typing.TypeVar("_EnvironmentT", bound=str)


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

        return self._client.build_request(method, url, params=params, json=body)


class SyncClientBase(BuildRequestMixin):
    def __init__(self, base_url: str, version: str, access_token: str) -> None:
        self._client = httpx.Client(
            base_url=base_url,
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
    def __init__(self, base_url: str, version: str, access_token: str) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url,
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


retort = adaptix.Retort()

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
                        retort.load(response.json(), error_class.error_type),
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
        return retort.load(response.json(), response_model)

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
    return None
