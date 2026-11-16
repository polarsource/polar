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

RequestTimeout: typing.TypeAlias = float | httpx.Timeout | httpx2.Timeout
AsyncClient: typing.TypeAlias = httpx.AsyncClient | httpx2.AsyncClient

HTTP_ERRORS = (httpx.HTTPError, httpx2.HTTPError)
STATUS_ERRORS = (httpx.HTTPStatusError, httpx2.HTTPStatusError)
STATUS_OR_TRANSPORT_ERRORS = (
    *STATUS_ERRORS,
    httpx.TransportError,
    httpx2.TransportError,
)


def to_httpx2_timeout(timeout: RequestTimeout | None) -> float | httpx2.Timeout | None:
    if isinstance(timeout, httpx2.Timeout):
        return timeout
    if isinstance(timeout, httpx.Timeout):
        return httpx2.Timeout(**timeout.as_dict())
    return timeout
