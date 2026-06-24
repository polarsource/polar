import ipaddress
import socket
import unicodedata
from dataclasses import dataclass
from typing import Annotated
from urllib.parse import parse_qs, quote, urlencode, urlparse, urlunparse

import anyio
import httpx
from fastapi import Depends, Query, Request
from pydantic import AfterValidator, HttpUrl, PlainSerializer, ValidationError
from safe_redirect_url import url_has_allowed_host_and_scheme

from polar.config import settings


def get_content_disposition(filename: str) -> str:
    """
    Generate a Content-Disposition header value for file downloads.

    Uses RFC 5987 encoding for non-ASCII filenames to ensure proper handling
    of special characters like colons, spaces, etc.
    """
    if filename.isascii():
        # RFC 6266 / RFC 7230: escape backslashes and quotes in quoted-strings,
        # and strip control characters (CR, LF, etc.) to prevent header injection
        safe_filename = filename.replace("\\", "\\\\").replace('"', '\\"')
        safe_filename = "".join(
            c for c in safe_filename if 32 <= ord(c) <= 126 or c in "\t"
        )
        return f'attachment; filename="{safe_filename}"'
    ascii_fallback = (
        unicodedata.normalize("NFKD", filename)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    encoded = quote(filename, safe="")
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


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
    """Validate the URL and GET it, following redirects.

    The check rejects URLs that resolve to private/reserved IPs (including any
    redirect target) and treats HTTP 2xx/3xx as reachable. We use GET rather
    than HEAD because some sites block HEAD requests.
    """
    try:
        validated_url = await validate_crawlable_url(url)
    except UnsafeCrawlableUrl as e:
        return UrlReachability(reachable=False, error=str(e))

    async def _check_redirect(response: httpx.Response) -> None:
        if response.is_redirect:
            location = response.headers.get("location", "")
            # `Location` may be a relative reference (RFC 7231). Resolve it
            # against the current URL — the same resolution httpx uses to
            # follow the redirect — so we validate the URL actually fetched.
            try:
                absolute_location = response.url.join(location)
            except httpx.InvalidURL as e:
                # A malformed `Location` (e.g. an invalid port) can't be
                # followed. `InvalidURL` isn't an `httpx.HTTPError`, so convert
                # it to the handled type instead of letting it escape.
                raise UnsafeCrawlableUrl(f"Invalid redirect URL: {e}") from e
            await validate_crawlable_url(str(absolute_location))

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": settings.POLAR_USER_AGENT},
            event_hooks={"response": [_check_redirect]},
        ) as client:
            response = await client.get(str(validated_url))
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


def is_localhost(request: Request) -> bool:
    return request.url.hostname in {"127.0.0.1", "localhost"}
