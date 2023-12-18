from typing import Annotated
from urllib.parse import urlparse

from fastapi import Depends, Query
from safe_redirect_url import url_has_allowed_host_and_scheme

from polar.config import settings


def get_safe_return_url(return_to: str | None) -> str:
    # Unsafe URL -> fallback to default
    if return_to is None or not url_has_allowed_host_and_scheme(
        return_to, settings.ALLOWED_HOSTS
    ):
        return settings.generate_frontend_url(settings.FRONTEND_DEFAULT_RETURN_PATH)

    # For paths, ensure we have an absolute URL on the frontend
    url_info = urlparse(return_to)
    if not url_info.netloc:
        return settings.generate_frontend_url(return_to)

    return return_to


async def _get_safe_return_url_dependency(return_to: str | None = Query(None)) -> str:
    return get_safe_return_url(return_to)


ReturnTo = Annotated[str, Depends(_get_safe_return_url_dependency)]
