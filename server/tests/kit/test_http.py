import socket
from unittest.mock import AsyncMock, patch

import pytest

from polar.kit.http import (
    SSRFBlockedError,
    get_safe_return_url,
    resolve_and_validate_ip,
)


@pytest.mark.asyncio
async def test_get_safe_return_url() -> None:
    assert get_safe_return_url("/foo") == "http://127.0.0.1:3000/foo"

    assert (
        get_safe_return_url("http://127.0.0.1:3000/foo") == "http://127.0.0.1:3000/foo"
    )

    assert get_safe_return_url("") == "http://127.0.0.1:3000/"

    assert get_safe_return_url("https://whatever.com/hey") == "http://127.0.0.1:3000/"


def _fake_getaddrinfo(*addrs: str) -> list[tuple[int, int, int, str, tuple[str, int]]]:
    """Build a fake getaddrinfo result list from IP strings."""
    return [
        (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (a, 0))
        for a in addrs
    ]


class TestResolveAndValidateIp:
    @pytest.mark.asyncio
    async def test_blocks_loopback(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("127.0.0.1")),
        ):
            with pytest.raises(SSRFBlockedError, match="private/reserved"):
                await resolve_and_validate_ip("localhost")

    @pytest.mark.asyncio
    async def test_blocks_private_10x(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("10.0.0.1")),
        ):
            with pytest.raises(SSRFBlockedError):
                await resolve_and_validate_ip("internal.example.com")

    @pytest.mark.asyncio
    async def test_blocks_private_172_16(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("172.16.0.1")),
        ):
            with pytest.raises(SSRFBlockedError):
                await resolve_and_validate_ip("internal.example.com")

    @pytest.mark.asyncio
    async def test_blocks_private_192_168(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("192.168.1.1")),
        ):
            with pytest.raises(SSRFBlockedError):
                await resolve_and_validate_ip("internal.example.com")

    @pytest.mark.asyncio
    async def test_blocks_link_local_metadata(self) -> None:
        """169.254.169.254 (AWS/GCP metadata) is link-local and must be blocked."""
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("169.254.169.254")),
        ):
            with pytest.raises(SSRFBlockedError, match="private/reserved"):
                await resolve_and_validate_ip("metadata.internal")

    @pytest.mark.asyncio
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

    @pytest.mark.asyncio
    async def test_allows_public_ip(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("93.184.216.34")),
        ):
            # Should not raise
            await resolve_and_validate_ip("example.com")

    @pytest.mark.asyncio
    async def test_blocks_mixed_public_and_private(self) -> None:
        """If even one resolved IP is private, the request must be blocked."""
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(return_value=_fake_getaddrinfo("93.184.216.34", "10.0.0.1")),
        ):
            with pytest.raises(SSRFBlockedError):
                await resolve_and_validate_ip("dual-homed.example.com")

    @pytest.mark.asyncio
    async def test_dns_failure(self) -> None:
        with patch(
            "anyio.getaddrinfo",
            new=AsyncMock(side_effect=OSError("NXDOMAIN")),
        ):
            with pytest.raises(SSRFBlockedError, match="DNS resolution failed"):
                await resolve_and_validate_ip("nonexistent.invalid")
