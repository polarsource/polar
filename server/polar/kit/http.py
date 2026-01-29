from typing import Annotated
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from fastapi import Depends, Query
from pydantic import AfterValidator, BeforeValidator, HttpUrl
from safe_redirect_url import url_has_allowed_host_and_scheme

from polar.config import settings

# Placeholder token for {CHECKOUT_ID} - this is used during URL validation
# to prevent Pydantic's HttpUrl from encoding the curly braces.
# We use a simple alphanumeric string that won't be URL-encoded.
_CHECKOUT_ID_PLACEHOLDER = "{CHECKOUT_ID}"
_CHECKOUT_ID_SAFE_MARKER = "POLARPLACEHOLDERCOID"


def _replace_checkout_id_for_validation(value: str | None) -> str | None:
    """Replace {CHECKOUT_ID} with a safe marker before URL validation."""
    if value is None:
        return None
    if isinstance(value, str):
        return value.replace(_CHECKOUT_ID_PLACEHOLDER, _CHECKOUT_ID_SAFE_MARKER)
    return value


def _restore_checkout_id_after_validation(url: HttpUrl) -> str:
    """Restore {CHECKOUT_ID} after URL validation and return as string."""
    return str(url).replace(_CHECKOUT_ID_SAFE_MARKER, _CHECKOUT_ID_PLACEHOLDER)


SuccessUrl = Annotated[
    HttpUrl,
    BeforeValidator(_replace_checkout_id_for_validation),
    AfterValidator(_restore_checkout_id_after_validation),
]
"""
A URL type that preserves the `{CHECKOUT_ID}` placeholder without encoding it.

This is used for success URLs where `{CHECKOUT_ID}` will be replaced with the
actual checkout ID at runtime (see `polar.models.checkout.Checkout.success_url`).
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
