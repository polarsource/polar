import collections.abc
import math
from time import monotonic

import httpx2

_AFFINITY_HEADER = "x-vercel-affinity-id"
_WARMUP_HEADER = "x-polar-affinity-warmup"
_NEXT_HEADER = "x-polar-affinity-next"
_DROPPED_HEADERS = {
    "content-length",
    "transfer-encoding",
    "connection",
    "host",
    _AFFINITY_HEADER,
    _WARMUP_HEADER,
    _NEXT_HEADER,
}

# After a failed warm-up, wait this long before trying again.
_WARMUP_RETRY_SECONDS = 1.0
# Next id -> earliest time to warm it again. Infinity once a warm-up has started.
_warmups: dict[str, float] = {}


def _header(headers: collections.abc.Mapping[str, str], name: str) -> str | None:
    return next((value for key, value in headers.items() if key.lower() == name), None)


def is_vercel_affinity_warmup(headers: collections.abc.Mapping[str, str]) -> bool:
    """True for the request that starts a shard's next instance: answer it once Outpost is up.

    The middleware of `@polar-sh/sdk/outpost/vercel` sends it: Vercel runs middleware in
    JavaScript only, whatever the language of the pinned function.
    """
    return any(
        name.lower() == _WARMUP_HEADER and value == "1"
        for name, value in headers.items()
    )


async def warm_next_vercel_instance(
    url: str,
    headers: collections.abc.Mapping[str, str],
    *,
    client: httpx2.AsyncClient | None = None,
) -> None:
    """Start the shard's next instance from the one that holds the shard, in the 30 s
    before the shard moves to it.

    Run it in the pinned route after the response, with the request's URL and headers:
    in FastAPI, as a background task.
    """
    next_id = _header(headers, _NEXT_HEADER)
    if next_id is None or next_id == _header(headers, _AFFINITY_HEADER):
        return
    if _warmups.get(next_id, 0.0) > monotonic():
        return
    _warmups[next_id] = math.inf
    # The request's own headers, so the warm-up passes the merchant's middleware as it did.
    warmup = {
        key: value
        for key, value in headers.items()
        if key.lower() not in _DROPPED_HEADERS
    }
    warmup[_AFFINITY_HEADER] = next_id
    warmup[_WARMUP_HEADER] = "1"
    try:
        if client is None:
            async with httpx2.AsyncClient() as owned:
                response = await owned.post(url, headers=warmup)
        else:
            response = await client.post(url, headers=warmup)
        warm = response.is_success
    except httpx2.HTTPError:
        warm = False
    if not warm:
        _warmups[next_id] = monotonic() + _WARMUP_RETRY_SECONDS
