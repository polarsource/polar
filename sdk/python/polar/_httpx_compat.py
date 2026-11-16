import typing

import httpx2

if typing.TYPE_CHECKING:
    import httpx
else:
    try:
        import httpx
    except ModuleNotFoundError as error:
        if error.name != "httpx":
            raise
        httpx = httpx2

Client = httpx2.Client
AsyncClient = httpx2.AsyncClient
Request = httpx2.Request
Response = httpx2.Response
RequestError = httpx2.RequestError
Timeout = httpx2.Timeout

RequestTimeout: typing.TypeAlias = float | httpx.Timeout | Timeout
AsyncClientType: typing.TypeAlias = httpx.AsyncClient | AsyncClient

HTTP_ERRORS = (httpx.HTTPError, httpx2.HTTPError)
STATUS_ERRORS = (httpx.HTTPStatusError, httpx2.HTTPStatusError)
STATUS_OR_TRANSPORT_ERRORS = (
    *STATUS_ERRORS,
    httpx.TransportError,
    httpx2.TransportError,
)


def to_httpx2_timeout(timeout: RequestTimeout | None) -> float | Timeout | None:
    if isinstance(timeout, Timeout):
        return timeout
    if isinstance(timeout, httpx.Timeout):
        return Timeout(**timeout.as_dict())
    return timeout
