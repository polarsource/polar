import types
import typing

import adaptix
import httpx


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
        params = {k: v for k, v in (query_params or {}).items() if v}
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
        return self._client.send(request)


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
        return await self._client.send(request)


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


class PolarError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class PolarErrorResponse(PolarError):
    error_type: typing.ClassVar[typing.Any]
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any):
        self.status_code = status_code
        self.error = error
        super().__init__(f"Polar API returned an error: {status_code} - {error}")

E = typing.TypeVar("E", bound=PolarErrorResponse)

def parse_response(
    response: httpx.Response,
    response_type: typing.Any,
    errors: dict[int, type[E]] | None = None,
) -> typing.Any:
    status_code = response.status_code
    try:
        error_class = (errors or {})[status_code]
        raise error_class(status_code, retort.load(response.json(), error_class.error_type))
    except KeyError:
        pass

    return retort.load(response.json(), response_type)
