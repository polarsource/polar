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


def to_httpx2_timeout(timeout: RequestTimeout | None) -> float | httpx2.Timeout | None:
    if isinstance(timeout, httpx2.Timeout):
        return timeout
    if isinstance(timeout, httpx.Timeout):
        return httpx2.Timeout(**timeout.as_dict())
    return timeout
