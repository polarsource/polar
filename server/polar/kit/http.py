import ipaddress
import socket
from dataclasses import dataclass
from typing import Annotated
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import anyio
import httpx
from fastapi import Depends, Query
from pydantic import AfterValidator, HttpUrl, PlainSerializer, ValidationError
from safe_redirect_url import url_has_allowed_host_and_scheme

from polar.config import settings


class SSRFBlockedError(Exception):
    """Raised when a request targets a private/reserved IP address."""


async def resolve_and_validate_ip(hostname: str) -> None:
    """Resolve *hostname* and raise `SSRFBlockedError` if any IP is private/reserved."""
    try:
        infos = await anyio.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except OSError as exc:
        raise SSRFBlockedError(f"DNS resolution failed for {hostname}") from exc

    for _family, _type, _proto, _canonname, sockaddr in infos:
        addr = ipaddress.ip_address(sockaddr[0])
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_reserved
            or addr.is_link_local
            or addr.is_multicast
            or addr.is_unspecified
        ):
            raise SSRFBlockedError(
                f"Blocked request to {hostname}: resolves to private/reserved IP {addr}"
            )


class UnsafeCrawlableUrl(Exception):
    """A URL that may point to private/reserved IPs, which we will validate manually."""


async def validate_crawlable_url(url: HttpUrl | str) -> HttpUrl:
    """
    Validate that the URL is crawlable (not private/reserved).

    Args:
        url: The URL to validate.

    Returns:
        The original URL if it's valid.

    Raises:
        UnsafeCrawlableUrl: If the URL is invalid or points to a private/reserved
    """
    if not isinstance(url, HttpUrl):
        try:
            url = HttpUrl(url)
        except ValidationError as e:
            raise UnsafeCrawlableUrl(f"Invalid URL: {e}") from e

    if url.host is None:
        raise UnsafeCrawlableUrl("URL must have a host")

    try:
        await resolve_and_validate_ip(url.host)
    except SSRFBlockedError as e:
        raise UnsafeCrawlableUrl(str(e)) from e
    return url


@dataclass
class UrlReachability:
    reachable: bool
    status: int | None = None
    error: str | None = None


async def check_url_reachable(
    url: HttpUrl | str, *, timeout: float = 5.0
) -> UrlReachability:
    """Validate the URL and HEAD it, following redirects.

    The check rejects URLs that resolve to private/reserved IPs (including any
    redirect target) and treats HTTP 2xx/3xx as reachable.
    """
    try:
        validated_url = await validate_crawlable_url(url)
    except UnsafeCrawlableUrl as e:
        return UrlReachability(reachable=False, error=str(e))

    async def _check_redirect(response: httpx.Response) -> None:
        if response.is_redirect:
            location = response.headers.get("location", "")
            await validate_crawlable_url(location)

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": settings.POLAR_USER_AGENT},
            event_hooks={"response": [_check_redirect]},
        ) as client:
            response = await client.head(str(validated_url))
        return UrlReachability(
            reachable=200 <= response.status_code < 400,
            status=response.status_code,
        )
    except UnsafeCrawlableUrl as e:
        return UrlReachability(reachable=False, error=str(e))
    except httpx.TimeoutException:
        return UrlReachability(reachable=False, error="Request timed out")
    except httpx.HTTPError:
        return UrlReachability(reachable=False, error="Unable to reach URL")


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
