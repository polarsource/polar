import collections.abc

_WARMUP_HEADER = "x-polar-affinity-warmup"


def is_vercel_affinity_warmup(headers: collections.abc.Mapping[str, str]) -> bool:
    """True for the request that starts a shard's next instance: answer it once Outpost is up.

    The middleware of `@polar-sh/sdk/outpost/vercel` sends it: Vercel runs middleware in
    JavaScript only, whatever the language of the pinned function.
    """
    return any(
        name.lower() == _WARMUP_HEADER and value == "1"
        for name, value in headers.items()
    )
