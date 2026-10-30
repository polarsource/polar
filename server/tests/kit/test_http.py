import socket
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from typing import Any, cast
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

import httpcore
import httpx
import pytest
from pydantic import TypeAdapter

from polar.kit.http import (
    SSRFBlockedError,
    SSRFSafeTransport,
    SuccessUrl,
    check_url_reachable,
    get_content_disposition,
    get_safe_return_url,
    resolve_and_validate_ip,
)


@pytest.mark.anyio
async def test_get_safe_return_url() -> None:
    assert get_safe_return_url("/foo") == "http://127.0.0.1:3000/foo"

    assert (
        get_safe_return_url("http://127.0.0.1:3000/foo") == "http://127.0.0.1:3000/foo"
    )

    assert get_safe_return_url("") == "http://127.0.0.1:3000/"

    assert get_safe_return_url("https://whatever.com/hey") == "http://127.0.0.1:3000/"

    assert get_safe_return_url("@example.com") == "http://127.0.0.1:3000/"

    assert get_safe_return_url("@example.com/path") == "http://127.0.0.1:3000/"


def _fake_getaddrinfo(*addrs: str) -> list[tuple[int, int, int, str, tuple[str, int]]]:
    """Build a fake getaddrinfo result list from IP strings."""
    return [
        (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (a, 0))
        for a in addrs
    ]


class TestResolveAndValidateIp:
    @pytest.mark.anyio
    async def test_blocks_loopback(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("127.0.0.1")),
        ):
            with pytest.raises(SSRFBlockedError, match="private/reserved"):
                await resolve_and_validate_ip("localhost")

    @pytest.mark.anyio
    async def test_blocks_private_10x(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("10.0.0.1")),
        ):
            with pytest.raises(SSRFBlockedError):
                await resolve_and_validate_ip("internal.example.com")

    @pytest.mark.anyio
    async def test_blocks_private_172_16(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("172.16.0.1")),
        ):
            with pytest.raises(SSRFBlockedError):
                await resolve_and_validate_ip("internal.example.com")

    @pytest.mark.anyio
    async def test_blocks_private_192_168(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("192.168.1.1")),
        ):
            with pytest.raises(SSRFBlockedError):
                await resolve_and_validate_ip("internal.example.com")

    @pytest.mark.anyio
    async def test_blocks_link_local_metadata(self) -> None:
        """169.254.169.254 (AWS/GCP metadata) is link-local and must be blocked."""
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("169.254.169.254")),
        ):
            with pytest.raises(SSRFBlockedError, match="private/reserved"):
                await resolve_and_validate_ip("metadata.internal")

    @pytest.mark.anyio
    async def test_blocks_ipv6_loopback(self) -> None:
        info = [
            (
                socket.AF_INET6,
                socket.SOCK_STREAM,
                socket.IPPROTO_TCP,
                "",
                ("::1", 0, 0, 0),
            )
        ]
        with patch("anyio.getaddrinfo", new=AsyncMock(return_value=info)):
            with pytest.raises(SSRFBlockedError):
                await resolve_and_validate_ip("localhost6")

    @pytest.mark.anyio
    async def test_allows_public_ip(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("93.184.216.34")),
        ):
            # Should not raise
            await resolve_and_validate_ip("example.com")

    @pytest.mark.anyio
    async def test_blocks_mixed_public_and_private(self) -> None:
        """If even one resolved IP is private, the request must be blocked."""
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("93.184.216.34", "10.0.0.1")),
        ):
            with pytest.raises(SSRFBlockedError):
                await resolve_and_validate_ip("dual-homed.example.com")

    @pytest.mark.anyio
    async def test_dns_failure(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(side_effect=OSError("NXDOMAIN")),
        ):
            with pytest.raises(SSRFBlockedError, match="DNS resolution failed"):
                await resolve_and_validate_ip("nonexistent.invalid")


class _RecordingBackend(httpcore.AsyncMockBackend):
    """Serve canned HTTP responses and record the address of each connection."""

    def __init__(self, *responses: bytes) -> None:
        super().__init__(list(responses))
        self.connected_hosts: list[str] = []

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Iterable[httpcore.SOCKET_OPTION] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        self.connected_hosts.append(host)
        return await super().connect_tcp(host, port)


@contextmanager
def _mock_network(backend: _RecordingBackend) -> Iterator[None]:
    with patch("polar.kit.http.httpcore.AnyIOBackend", return_value=backend):
        yield


def _response(status: int, *headers: str) -> bytes:
    lines = [f"HTTP/1.1 {status} X", "Content-Length: 0", *headers]
    return ("\r\n".join(lines) + "\r\n\r\n").encode()


class TestCheckUrlReachable:
    @pytest.mark.anyio
    async def test_follows_relative_redirect_location(self) -> None:
        """A relative `Location` (e.g. `/login`) must be resolved, not rejected.

        A relative location previously failed `HttpUrl` parsing and wrongly
        marked the site unreachable; it must be resolved against the request
        URL before being followed.
        """
        backend = _RecordingBackend(_response(307, "Location: /login"), _response(200))

        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("93.184.216.34")),
        ):
            with _mock_network(backend):
                result = await check_url_reachable("https://example.com")

        assert result.reachable is True
        assert result.status == 200

    @pytest.mark.anyio
    async def test_blocks_redirect_to_private_host(self) -> None:
        """SSRF protection still holds: a redirect to a private IP is blocked."""
        backend = _RecordingBackend(
            _response(302, "Location: https://internal.example.com/")
        )

        async def fake_getaddrinfo(
            host: str, *args: object, **kwargs: object
        ) -> list[tuple[int, int, int, str, tuple[str, int]]]:
            if host == "internal.example.com":
                return _fake_getaddrinfo("10.0.0.1")
            return _fake_getaddrinfo("93.184.216.34")

        with patch("anyio.getaddrinfo", new=fake_getaddrinfo):
            with _mock_network(backend):
                result = await check_url_reachable("https://example.com")

        assert result.reachable is False
        assert result.error is not None
        assert "private/reserved" in result.error
        assert backend.connected_hosts == ["93.184.216.34"]

    @pytest.mark.anyio
    async def test_dns_rebinding(self) -> None:
        """The connection goes to the IP we validated, not a fresh lookup.

        A rebinding host answers a public IP to the first lookup and a private
        one afterwards; the second answer must never be used.
        """
        backend = _RecordingBackend(_response(200))
        getaddrinfo = AsyncMock(
            side_effect=[
                _fake_getaddrinfo("93.184.216.34"),
                _fake_getaddrinfo("127.0.0.1"),
            ]
        )

        with patch("anyio.getaddrinfo", new=getaddrinfo):
            with _mock_network(backend):
                result = await check_url_reachable("http://rebind.example.com:8000")

        assert result.reachable is True
        assert backend.connected_hosts == ["93.184.216.34"]
        assert getaddrinfo.await_count == 1

    @pytest.mark.anyio
    async def test_blocks_private_host(self) -> None:
        backend = _RecordingBackend(_response(200))

        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("127.0.0.1")),
        ):
            with _mock_network(backend):
                result = await check_url_reachable("http://rebind.example.com:8000")

        assert result.reachable is False
        assert result.error is not None
        assert "127.0.0.1" in result.error
        assert backend.connected_hosts == []

    @pytest.mark.anyio
    async def test_malformed_redirect_location(self) -> None:
        """A malformed `Location` (e.g. invalid port) is unreachable, not a 500."""
        backend = _RecordingBackend(
            _response(302, "Location: https://example.com:abc/login")
        )

        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("93.184.216.34")),
        ):
            with _mock_network(backend):
                result = await check_url_reachable("https://example.com")

        assert result.reachable is False
        assert result.error is not None

    @pytest.mark.anyio
    async def test_unreachable_on_4xx(self) -> None:
        backend = _RecordingBackend(_response(404))

        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("93.184.216.34")),
        ):
            with _mock_network(backend):
                result = await check_url_reachable("https://example.com")

        assert result.reachable is False
        assert result.status == 404


class TestSSRFSafeTransport:
    @pytest.mark.anyio
    async def test_keeps_hostname_for_host_header(self) -> None:
        backend = _RecordingBackend(_response(200))
        captured: list[httpx.Request] = []

        async def capture(request: httpx.Request) -> None:
            captured.append(request)

        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("93.184.216.34")),
        ):
            with _mock_network(backend):
                async with httpx.AsyncClient(
                    transport=SSRFSafeTransport(),
                    event_hooks={"request": [capture]},
                ) as client:
                    response = await client.post("https://example.com/webhook")

        assert response.status_code == 200
        assert backend.connected_hosts == ["93.184.216.34"]
        assert captured[0].headers["host"] == "example.com"

    @pytest.mark.anyio
    async def test_blocks_private_ip(self) -> None:
        backend = _RecordingBackend(_response(200))

        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("169.254.169.254")),
        ):
            with _mock_network(backend):
                async with httpx.AsyncClient(transport=SSRFSafeTransport()) as client:
                    with pytest.raises(SSRFBlockedError):
                        await client.post("https://metadata.example.com/webhook")

        assert backend.connected_hosts == []

    @pytest.mark.anyio
    async def test_falls_back_to_next_ip_on_connect_error(self) -> None:
        backend = _RecordingBackend(_response(200))
        original_connect_tcp = backend.connect_tcp

        async def connect_tcp(host: str, port: int, **kwargs: Any) -> Any:
            stream = await original_connect_tcp(host, port, **kwargs)
            if host == "93.184.216.34":
                raise httpcore.ConnectError("refused")
            return stream

        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(
                return_value=_fake_getaddrinfo("93.184.216.34", "93.184.216.35")
            ),
        ):
            with patch.object(backend, "connect_tcp", new=connect_tcp):
                with _mock_network(backend):
                    async with httpx.AsyncClient(
                        transport=SSRFSafeTransport()
                    ) as client:
                        response = await client.get("https://example.com")

        assert response.status_code == 200
        assert backend.connected_hosts == ["93.184.216.34", "93.184.216.35"]


class TestGetContentDisposition:
    def test_pure_ascii(self) -> None:
        assert (
            get_content_disposition("hello.mp3") == 'attachment; filename="hello.mp3"'
        )

    def test_non_latin1_character(self) -> None:
        result = get_content_disposition("Sample\u2019s Filename.mp3")
        assert result == (
            'attachment; filename="Samples Filename.mp3"; '
            "filename*=UTF-8''Sample%E2%80%99s%20Filename.mp3"
        )
        assert result.encode("latin-1")

    def test_latin1_character(self) -> None:
        result = get_content_disposition("café.mp3")
        assert result == (
            "attachment; filename=\"cafe.mp3\"; filename*=UTF-8''caf%C3%A9.mp3"
        )
        assert result.encode("latin-1")

    def test_shift_jis_character(self) -> None:
        result = get_content_disposition("サンプル.mp3")
        assert result == (
            'attachment; filename=".mp3"; '
            "filename*=UTF-8''%E3%82%B5%E3%83%B3%E3%83%97%E3%83%AB.mp3"
        )
        assert result.encode("latin-1")

    def test_quotes_escaped(self) -> None:
        # Quotes must be escaped to prevent breaking out of the quoted-string
        result = get_content_disposition('file"with"quotes.txt')
        assert result == 'attachment; filename="file\\"with\\"quotes.txt"'

    def test_backslashes_escaped(self) -> None:
        # Backslashes must be escaped in quoted-strings per RFC 7230
        result = get_content_disposition("file\\with\\backslash.txt")
        assert result == 'attachment; filename="file\\\\with\\\\backslash.txt"'

    def test_control_characters_removed(self) -> None:
        # CR, LF, and other control characters must be removed to prevent header injection
        result = get_content_disposition("file\nwith\nnewline.txt")
        assert result == 'attachment; filename="filewithnewline.txt"'

        result = get_content_disposition("file\rwith\rcarriage.txt")
        assert result == 'attachment; filename="filewithcarriage.txt"'

        result = get_content_disposition("file\x00null.txt")
        assert result == 'attachment; filename="filenull.txt"'

    def test_del_character_removed(self) -> None:
        # ASCII DEL (0x7F) must be removed to prevent unsafe header bytes
        result = get_content_disposition("file\x7fdel.txt")
        assert result == 'attachment; filename="filedel.txt"'


class TestSuccessUrl:
    """The checkout adapters (nextjs/tanstack-start/nuxt) forward the merchant's
    `success_url` with a literal `{CHECKOUT_ID}` placeholder and must not over-decode
    the merchant's own percent-escapes (see the `decodeURI` regression fix). They rely
    on `SuccessUrl` storing valid percent-escapes verbatim and unescaping the
    `%7BCHECKOUT_ID%7D` placeholder back to `{CHECKOUT_ID}`. These tests pin that
    contract so the merchant's success page reads exactly the value they encoded.
    """

    @pytest.mark.parametrize(
        ("input_url", "expected"),
        [
            pytest.param(
                "https://example.com/success?checkoutId={CHECKOUT_ID}",
                "https://example.com/success?checkoutId={CHECKOUT_ID}",
                id="literal_placeholder_preserved",
            ),
            pytest.param(
                "https://example.com/success?checkoutId=%7BCHECKOUT_ID%7D",
                "https://example.com/success?checkoutId={CHECKOUT_ID}",
                id="encoded_placeholder_unescaped",
            ),
            pytest.param(
                "https://example.com/success?data=%2541&checkoutId={CHECKOUT_ID}",
                "https://example.com/success?data=%2541&checkoutId={CHECKOUT_ID}",
                id="percent_prefixed_literal_preserved",
            ),
            pytest.param(
                "https://example.com/success?data=%2500&checkoutId={CHECKOUT_ID}",
                "https://example.com/success?data=%2500&checkoutId={CHECKOUT_ID}",
                id="percent_prefixed_nul_literal_preserved",
            ),
            pytest.param(
                "https://example.com/success?discount=50%25off&checkoutId={CHECKOUT_ID}",
                "https://example.com/success?discount=50%25off&checkoutId={CHECKOUT_ID}",
                id="embedded_percent_preserved",
            ),
        ],
    )
    def test_validate_preserves_merchant_escapes(
        self, input_url: str, expected: str
    ) -> None:
        assert TypeAdapter(SuccessUrl).validate_python(input_url) == expected

    def test_success_page_reads_intended_literal_after_substitution(self) -> None:
        # End-to-end simulation of the server pipeline: validate -> store -> substitute
        # {CHECKOUT_ID} with the real id -> merchant reads query params.
        stored = cast(
            str,
            TypeAdapter(SuccessUrl).validate_python(
                "https://example.com/success?data=%2541&checkoutId={CHECKOUT_ID}"
            ),
        )
        assert "{CHECKOUT_ID}" in stored

        after_substitution = stored.replace("{CHECKOUT_ID}", "chk_123")
        query = parse_qs(urlparse(after_substitution).query)
        # The merchant encoded %2541 so the success page receives the literal %41.
        assert query["data"] == ["%41"]
        assert query["checkoutId"] == ["chk_123"]
