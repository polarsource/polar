import ipaddress
import socket
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Annotated
from urllib.parse import parse_qs, quote, urlencode, urlparse, urlunparse

import anyio
import httpcore
import httpx
from fastapi import Depends, Query, Request
from pydantic import AfterValidator, HttpUrl, PlainSerializer, ValidationError
from safe_redirect_url import url_has_allowed_host_and_scheme
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

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


def _is_blocked_ip(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_reserved
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_unspecified
    )


async def resolve_and_validate_ip(hostname: str) -> list[str]:
    """Resolve *hostname* and raise `SSRFBlockedError` if any IP is private/reserved.

    Returns the resolved IPs. Checking a hostname and then letting an HTTP client
    resolve it again is open to DNS rebinding: to be safe, connect to one of the
    returned IPs, as `SSRFSafeTransport` does.
    """
    try:
        infos = await anyio.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except OSError as exc:
        raise SSRFBlockedError(f"DNS resolution failed for {hostname}") from exc

    ips: list[str] = []
    for _family, _type, _proto, _canonname, sockaddr in infos:
        addr = ipaddress.ip_address(sockaddr[0])
        if _is_blocked_ip(addr):
            raise SSRFBlockedError(
                f"Blocked request to {hostname}: resolves to private/reserved IP {addr}"
            )
        if str(addr) not in ips:
            ips.append(str(addr))
    return ips


class _SSRFSafeNetworkBackend(httpcore.AsyncNetworkBackend):
    """Resolve and validate the host, then connect to the validated IP.

    The URL keeps its hostname, so the `Host` header, TLS SNI and certificate
    verification are unchanged; only the address the socket connects to is
    pinned to the IP we checked.
    """

    def __init__(self) -> None:
        self._backend = httpcore.AnyIOBackend()

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Iterable[httpcore.SOCKET_OPTION] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        try:
            with anyio.fail_after(timeout):
                ips = await resolve_and_validate_ip(host)
        except TimeoutError as e:
            raise httpcore.ConnectTimeout(f"DNS resolution timed out for {host}") from e

        error: httpcore.ConnectError | None = None
        for ip in ips:
            try:
                return await self._backend.connect_tcp(
                    ip,
                    port,
                    timeout=timeout,
                    local_address=local_address,
                    socket_options=socket_options,
                )
            except httpcore.ConnectError as e:
                error = e
        assert error is not None
        raise error

    async def sleep(self, seconds: float) -> None:
        await self._backend.sleep(seconds)


class SSRFSafeTransport(httpx.AsyncHTTPTransport):
    """HTTPX transport that refuses to connect to private/reserved IPs.

    Every connection, including the ones made while following redirects, is
    validated. It raises `SSRFBlockedError` when the host resolves to a
    private/reserved IP. Proxies are not supported, since we'd only validate
    the proxy's address.
    """

    def __init__(self) -> None:
        super().__init__()
        # Same limits as HTTPX's defaults
        self._pool = httpcore.AsyncConnectionPool(
            ssl_context=httpx.create_ssl_context(),
            max_connections=100,
            max_keepalive_connections=20,
            keepalive_expiry=5.0,
            network_backend=_SSRFSafeNetworkBackend(),
        )


@dataclass
class UrlReachability:
    reachable: bool
    status: int | None = None
    error: str | None = None


async def check_url_reachable(
    url: HttpUrl | str, *, timeout: float = 5.0
) -> UrlReachability:
    """GET the URL, following redirects.

    The check rejects URLs that resolve to private/reserved IPs (including any
    redirect target, see `SSRFSafeTransport`) and treats HTTP 2xx/3xx as
    reachable. We use GET rather than HEAD because some sites block HEAD requests.
    """
    try:
        url = HttpUrl(str(url))
    except ValidationError as e:
        return UrlReachability(reachable=False, error=f"Invalid URL: {e}")

    try:
        async with httpx.AsyncClient(
            transport=SSRFSafeTransport(),
            follow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": settings.POLAR_USER_AGENT},
        ) as client:
            response = await client.get(str(url))
        return UrlReachability(
            reachable=200 <= response.status_code < 400,
            status=response.status_code,
        )
    except SSRFBlockedError as e:
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
        # Only accept paths that start with "/" to prevent open redirect via
        # URL manipulation. A bare "@evil.com" would otherwise be naively
        # concatenated with FRONTEND_BASE_URL to produce
        # "https://polar.sh@evil.com", which browsers interpret as navigating
        # to evil.com ("@" is the userinfo delimiter per RFC 3986).
        if not return_to.startswith("/"):
            return settings.generate_frontend_url(settings.FRONTEND_DEFAULT_RETURN_PATH)
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


def get_ip_address(request: Request) -> str | None:
    """
    Get the client's IP address.

    Favor the highly trusted `True-Client-IP` header if present (set by Cloudflare),
    otherwise fall back to the request's client host.
    """
    try:
        return request.headers["True-Client-IP"]
    except KeyError:
        pass

    if request.client:
        return request.client.host

    return None


class HSTSMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                headers = MutableHeaders(scope=message)
                headers["Strict-Transport-Security"] = (
                    "max-age=63072000; includeSubDomains"
                )
            await send(message)

        await self.app(scope, receive, send_wrapper)
