from typing import Annotated
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from fastapi import Depends, Query
from pydantic import AfterValidator, HttpUrl, PlainSerializer
from safe_redirect_url import url_has_allowed_host_and_scheme

from polar.config import settings


def _unescape_checkout_id_placeholder(url: HttpUrl) -> str:
    """Unescape %7BCHECKOUT_ID%7D back to {CHECKOUT_ID} after URL validation."""
    return str(url).replace("%7BCHECKOUT_ID%7D", "{CHECKOUT_ID}")


SuccessUrl = Annotated[
    HttpUrl,
    AfterValidator(_unescape_checkout_id_placeholder),
    PlainSerializer(lambda x: x, return_type=str),
]
"""
HttpUrl encodes `{CHECKOUT_ID}` to `%7BCHECKOUT_ID%7D`, so we unescape it after
validation. This placeholder is replaced with the actual checkout ID at runtime
(see `polar.models.checkout.Checkout.success_url`).

The PlainSerializer then ensures `{CHECKOUT_ID}` doesn't get escaped again.
"""


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


def add_query_parameters(url: str, **kwargs: str | list[str]) -> str:
    scheme, netloc, path, params, query, fragment = urlparse(url)
    parsed_query = parse_qs(query)
    return urlunparse(
        (
            scheme,
            netloc,
            path,
            params,
            urlencode({**parsed_query, **kwargs}, doseq=True),
            fragment,
        )
    )
