import asyncio
import socket
from collections.abc import Awaitable, Callable
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from polar.organization_review.collectors.website import (
    MAX_CHARS_PER_PAGE,
    MAX_PAGES,
    MAX_REDIRECTS,
    SSRFBlockedError,
    WebsiteDeps,
    _build_tool_response,
    _extract_links_from_html,
    _is_allowed_origin,
    _resolve_and_validate_ip,
    browse_page,
    collect_website_data,
    fetch_page,
)
from polar.organization_review.schemas import WebsiteData

# Shorthand for patching _resolve_and_validate_ip to allow all IPs
_PATCH_SSRF = patch(
    "polar.organization_review.collectors.website._resolve_and_validate_ip",
    new_callable=AsyncMock,
)

# ---------------------------------------------------------------------------
# _is_allowed_origin
# ---------------------------------------------------------------------------


class TestIsAllowedOrigin:
    def test_exact_match(self) -> None:
        assert _is_allowed_origin("https://example.com/page", "example.com") is True

    def test_subdomain_allowed(self) -> None:
        assert _is_allowed_origin("https://www.example.com/page", "example.com") is True
        assert (
            _is_allowed_origin("https://docs.example.com/page", "example.com") is True
        )

    def test_different_domain_rejected(self) -> None:
        assert _is_allowed_origin("https://evil.com/page", "example.com") is False

    def test_suffix_match_not_allowed(self) -> None:
        """notexample.com should not match example.com."""
        assert _is_allowed_origin("https://notexample.com/page", "example.com") is False

    def test_non_http_scheme_rejected(self) -> None:
        assert _is_allowed_origin("ftp://example.com/file", "example.com") is False
        assert _is_allowed_origin("javascript:alert(1)", "example.com") is False

    def test_empty_url(self) -> None:
        assert _is_allowed_origin("", "example.com") is False

    def test_no_hostname(self) -> None:
        assert _is_allowed_origin("https://", "example.com") is False


# ---------------------------------------------------------------------------
# _extract_links_from_html
# ---------------------------------------------------------------------------


class TestExtractLinksFromHtml:
    def test_extracts_same_origin_links(self) -> None:
        html = """
        <html><body>
            <a href="/about">About</a>
            <a href="https://example.com/pricing">Pricing</a>
        </body></html>
        """
        links = _extract_links_from_html(html, "https://example.com/")
        assert len(links) == 2
        assert "About -> https://example.com/about" in links
        assert "Pricing -> https://example.com/pricing" in links

    def test_filters_external_links(self) -> None:
        html = """
        <html><body>
            <a href="https://example.com/home">Home</a>
            <a href="https://evil.com/phish">Evil</a>
        </body></html>
        """
        links = _extract_links_from_html(html, "https://example.com/")
        assert len(links) == 1
        assert "Home" in links[0]

    def test_skips_javascript_and_anchor_links(self) -> None:
        html = """
        <html><body>
            <a href="javascript:void(0)">JS Link</a>
            <a href="#section">Anchor</a>
            <a href="mailto:hi@example.com">Email</a>
            <a href="/real">Real</a>
        </body></html>
        """
        links = _extract_links_from_html(html, "https://example.com/")
        assert len(links) == 1
        assert "Real -> https://example.com/real" in links

    def test_deduplicates_links(self) -> None:
        html = """
        <html><body>
            <a href="/about">About</a>
            <a href="/about">About Us</a>
        </body></html>
        """
        links = _extract_links_from_html(html, "https://example.com/")
        assert len(links) == 1

    def test_caps_at_40_links(self) -> None:
        anchors = "\n".join(f'<a href="/page-{i}">Page {i}</a>' for i in range(60))
        html = f"<html><body>{anchors}</body></html>"
        links = _extract_links_from_html(html, "https://example.com/")
        assert len(links) == 40

    def test_empty_html(self) -> None:
        links = _extract_links_from_html("", "https://example.com/")
        assert links == []

    def test_truncates_link_text_at_80_chars(self) -> None:
        long_text = "A" * 120
        html = f'<html><body><a href="/page">{long_text}</a></body></html>'
        links = _extract_links_from_html(html, "https://example.com/")
        assert len(links) == 1
        text_part = links[0].split(" -> ")[0]
        assert len(text_part) == 80


# ---------------------------------------------------------------------------
# _build_tool_response
# ---------------------------------------------------------------------------


class TestBuildToolResponse:
    def test_basic_response(self) -> None:
        result = _build_tool_response(
            title="Test Page",
            current_url="https://example.com/",
            pages_navigated=1,
            content="Hello world",
            truncated=False,
            links=[],
        )
        assert "Page: Test Page (https://example.com/)" in result
        assert f"Pages visited: 1/{MAX_PAGES}" in result
        assert "Hello world" in result
        assert "(content truncated)" not in result
        assert "Links:" not in result

    def test_truncated_marker(self) -> None:
        result = _build_tool_response(
            title="Test",
            current_url="https://example.com/",
            pages_navigated=1,
            content="Some content",
            truncated=True,
            links=[],
        )
        assert "(content truncated)" in result

    def test_with_links(self) -> None:
        result = _build_tool_response(
            title="Test",
            current_url="https://example.com/",
            pages_navigated=1,
            content="Content",
            truncated=False,
            links=["About -> https://example.com/about"],
        )
        assert "Links:" in result
        assert "About -> https://example.com/about" in result

    def test_empty_content_shows_hint(self) -> None:
        result = _build_tool_response(
            title="Test",
            current_url="https://example.com/",
            pages_navigated=1,
            content="",
            truncated=False,
            links=[],
        )
        assert "(empty page)" in result

    def test_custom_empty_hint(self) -> None:
        result = _build_tool_response(
            title="Test",
            current_url="https://example.com/",
            pages_navigated=1,
            content="",
            truncated=False,
            links=[],
            empty_hint="(needs JS rendering)",
        )
        assert "(needs JS rendering)" in result

    def test_untitled_page(self) -> None:
        result = _build_tool_response(
            title=None,
            current_url="https://example.com/",
            pages_navigated=1,
            content="Content",
            truncated=False,
            links=[],
        )
        assert "Page: Untitled (https://example.com/)" in result


# ---------------------------------------------------------------------------
# fetch_page tool
# ---------------------------------------------------------------------------


class TestFetchPage:
    @pytest.mark.asyncio
    async def test_rejects_off_origin_url(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        result = await fetch_page(ctx, "https://evil.com/steal")

        assert "off-origin" in result
        assert deps.pages_navigated == 0
        client.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_respects_page_limit(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(
            client=client,
            allowed_domain="example.com",
            pages_navigated=MAX_PAGES,
        )
        ctx = MagicMock()
        ctx.deps = deps

        result = await fetch_page(ctx, "https://example.com/page")

        assert "Page limit reached" in result
        client.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_successful_fetch(self) -> None:
        html = """
        <html>
        <head><title>My Site</title></head>
        <body>
            <p>Welcome to my website. This is a real business.</p>
            <a href="/about">About</a>
        </body>
        </html>
        """
        response = MagicMock(spec=httpx.Response)
        response.status_code = 200
        response.text = html
        response.url = httpx.URL("https://example.com/")
        response.is_redirect = False
        response.has_redirect_location = False

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _PATCH_SSRF:
            result = await fetch_page(ctx, "https://example.com/")

        assert deps.pages_navigated == 1
        assert len(deps.pages_visited) == 1
        assert deps.pages_visited[0].url == "https://example.com/"
        assert deps.pages_visited[0].title == "My Site"
        assert "Page: My Site" in result

    @pytest.mark.asyncio
    async def test_http_error(self) -> None:
        response = MagicMock(spec=httpx.Response)
        response.status_code = 404
        response.is_redirect = False
        response.has_redirect_location = False

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _PATCH_SSRF:
            result = await fetch_page(ctx, "https://example.com/missing")

        assert "Error: HTTP 404" in result
        assert deps.pages_navigated == 1

    @pytest.mark.asyncio
    async def test_connection_error(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.side_effect = httpx.ConnectError("Connection refused")

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _PATCH_SSRF:
            result = await fetch_page(ctx, "https://example.com/")

        assert "Error fetching" in result
        assert deps.pages_navigated == 1

    @pytest.mark.asyncio
    async def test_content_truncation(self) -> None:
        long_body = "x" * (MAX_CHARS_PER_PAGE + 5_000)
        html = f"<html><head><title>Big</title></head><body><p>{long_body}</p></body></html>"

        response = MagicMock(spec=httpx.Response)
        response.status_code = 200
        response.text = html
        response.url = httpx.URL("https://example.com/")
        response.is_redirect = False
        response.has_redirect_location = False

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _PATCH_SSRF:
            result = await fetch_page(ctx, "https://example.com/")

        assert deps.pages_visited[0].content_truncated is True
        assert len(deps.pages_visited[0].content) <= MAX_CHARS_PER_PAGE
        assert "(content truncated)" in result


# ---------------------------------------------------------------------------
# collect_website_data (public API)
# ---------------------------------------------------------------------------


class TestCollectWebsiteData:
    @pytest.mark.asyncio
    async def test_prepends_https_if_missing(self) -> None:
        with patch(
            "polar.organization_review.collectors.website._run_website_agent",
            new_callable=AsyncMock,
        ) as mock_run:
            mock_run.return_value = WebsiteData(base_url="https://example.com")

            result = await collect_website_data("example.com")

            mock_run.assert_called_once_with("https://example.com")
            assert result.base_url == "https://example.com"

    @pytest.mark.asyncio
    async def test_strips_trailing_slash(self) -> None:
        with patch(
            "polar.organization_review.collectors.website._run_website_agent",
            new_callable=AsyncMock,
        ) as mock_run:
            mock_run.return_value = WebsiteData(base_url="https://example.com")

            await collect_website_data("https://example.com/")

            mock_run.assert_called_once_with("https://example.com")

    @pytest.mark.asyncio
    async def test_timeout_returns_error_data(self) -> None:
        async def slow_agent(url: str) -> WebsiteData:
            await asyncio.sleep(999)
            return WebsiteData(base_url=url)

        with (
            patch(
                "polar.organization_review.collectors.website._run_website_agent",
                side_effect=slow_agent,
            ),
            patch(
                "polar.organization_review.collectors.website.OVERALL_TIMEOUT_S", 0.01
            ),
        ):
            result = await collect_website_data("https://example.com")

        assert result.scrape_error is not None
        assert "timeout" in result.scrape_error.lower()

    @pytest.mark.asyncio
    async def test_exception_returns_error_data(self) -> None:
        with patch(
            "polar.organization_review.collectors.website._run_website_agent",
            new_callable=AsyncMock,
            side_effect=RuntimeError("boom"),
        ):
            result = await collect_website_data("https://example.com")

        assert result.scrape_error is not None
        assert "boom" in result.scrape_error


# ---------------------------------------------------------------------------
# WebsiteDeps cleanup
# ---------------------------------------------------------------------------


class TestWebsiteDepsCleanup:
    @pytest.mark.asyncio
    async def test_cleanup_when_browser_not_initialized(self) -> None:
        """Cleanup should be a no-op when browser was never started."""
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")

        # Should not raise
        await deps.cleanup()

    @pytest.mark.asyncio
    async def test_cleanup_closes_browser_and_playwright(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")

        mock_browser = AsyncMock()
        mock_playwright = AsyncMock()
        deps._browser = mock_browser
        deps._playwright = mock_playwright

        await deps.cleanup()

        mock_browser.close.assert_called_once()
        mock_playwright.stop.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_handles_browser_close_error(self) -> None:
        """Playwright stop should still be called even if browser.close fails."""
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")

        mock_browser = AsyncMock()
        mock_browser.close.side_effect = RuntimeError("close failed")
        mock_playwright = AsyncMock()
        deps._browser = mock_browser
        deps._playwright = mock_playwright

        await deps.cleanup()

        mock_playwright.stop.assert_called_once()


# ---------------------------------------------------------------------------
# _resolve_and_validate_ip
# ---------------------------------------------------------------------------


def _fake_getaddrinfo(*addrs: str) -> list[tuple[int, int, int, str, tuple[str, int]]]:
    """Build a fake getaddrinfo result list from IP strings."""
    return [
        (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (a, 0))
        for a in addrs
    ]


class TestResolveAndValidateIp:
    @pytest.mark.asyncio
    async def test_blocks_loopback(self) -> None:
        with patch("socket.getaddrinfo", return_value=_fake_getaddrinfo("127.0.0.1")):
            with pytest.raises(SSRFBlockedError, match="private/reserved"):
                await _resolve_and_validate_ip("localhost")

    @pytest.mark.asyncio
    async def test_blocks_private_10x(self) -> None:
        with patch("socket.getaddrinfo", return_value=_fake_getaddrinfo("10.0.0.1")):
            with pytest.raises(SSRFBlockedError):
                await _resolve_and_validate_ip("internal.example.com")

    @pytest.mark.asyncio
    async def test_blocks_private_172_16(self) -> None:
        with patch("socket.getaddrinfo", return_value=_fake_getaddrinfo("172.16.0.1")):
            with pytest.raises(SSRFBlockedError):
                await _resolve_and_validate_ip("internal.example.com")

    @pytest.mark.asyncio
    async def test_blocks_private_192_168(self) -> None:
        with patch("socket.getaddrinfo", return_value=_fake_getaddrinfo("192.168.1.1")):
            with pytest.raises(SSRFBlockedError):
                await _resolve_and_validate_ip("internal.example.com")

    @pytest.mark.asyncio
    async def test_blocks_link_local_metadata(self) -> None:
        """169.254.169.254 (AWS/GCP metadata) is link-local and must be blocked."""
        with patch(
            "socket.getaddrinfo", return_value=_fake_getaddrinfo("169.254.169.254")
        ):
            with pytest.raises(SSRFBlockedError, match="private/reserved"):
                await _resolve_and_validate_ip("metadata.internal")

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
        with patch("socket.getaddrinfo", return_value=info):
            with pytest.raises(SSRFBlockedError):
                await _resolve_and_validate_ip("localhost6")

    @pytest.mark.asyncio
    async def test_allows_public_ip(self) -> None:
        with patch(
            "socket.getaddrinfo", return_value=_fake_getaddrinfo("93.184.216.34")
        ):
            # Should not raise
            await _resolve_and_validate_ip("example.com")

    @pytest.mark.asyncio
    async def test_blocks_mixed_public_and_private(self) -> None:
        """If even one resolved IP is private, the request must be blocked."""
        with patch(
            "socket.getaddrinfo",
            return_value=_fake_getaddrinfo("93.184.216.34", "10.0.0.1"),
        ):
            with pytest.raises(SSRFBlockedError):
                await _resolve_and_validate_ip("dual-homed.example.com")

    @pytest.mark.asyncio
    async def test_dns_failure(self) -> None:
        with patch("socket.getaddrinfo", side_effect=socket.gaierror("NXDOMAIN")):
            with pytest.raises(SSRFBlockedError, match="DNS resolution failed"):
                await _resolve_and_validate_ip("nonexistent.invalid")


# ---------------------------------------------------------------------------
# fetch_page — SSRF & redirect tests
# ---------------------------------------------------------------------------


class TestFetchPageSSRF:
    @pytest.mark.asyncio
    async def test_blocks_initial_ssrf(self) -> None:
        """fetch_page should block a URL that resolves to a private IP."""
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with patch(
            "polar.organization_review.collectors.website._resolve_and_validate_ip",
            new_callable=AsyncMock,
            side_effect=SSRFBlockedError("resolves to private IP 10.0.0.1"),
        ):
            result = await fetch_page(ctx, "https://example.com/")

        assert "private IP" in result
        assert deps.pages_navigated == 0
        client.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_blocks_redirect_to_private_ip(self) -> None:
        """Redirect targets that resolve to private IPs should be blocked."""
        redirect_resp = MagicMock(spec=httpx.Response)
        redirect_resp.is_redirect = True
        redirect_resp.has_redirect_location = True
        redirect_resp.headers = {"location": "https://example.com/internal"}
        redirect_resp.status_code = 302

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = redirect_resp

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        call_count = 0

        async def _validate_side_effect(hostname: str) -> None:
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                raise SSRFBlockedError(f"Blocked: {hostname} resolves to private IP")

        with patch(
            "polar.organization_review.collectors.website._resolve_and_validate_ip",
            new_callable=AsyncMock,
            side_effect=_validate_side_effect,
        ):
            result = await fetch_page(ctx, "https://example.com/")

        assert "private IP" in result

    @pytest.mark.asyncio
    async def test_blocks_redirect_to_different_domain(self) -> None:
        """Redirects to a different domain should be blocked."""
        redirect_resp = MagicMock(spec=httpx.Response)
        redirect_resp.is_redirect = True
        redirect_resp.has_redirect_location = True
        redirect_resp.headers = {"location": "https://evil.com/steal"}
        redirect_resp.status_code = 302

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = redirect_resp

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _PATCH_SSRF:
            result = await fetch_page(ctx, "https://example.com/")

        assert "off-origin" in result

    @pytest.mark.asyncio
    async def test_follows_valid_same_origin_redirect(self) -> None:
        """Valid same-origin redirects should be followed."""
        redirect_resp = MagicMock(spec=httpx.Response)
        redirect_resp.is_redirect = True
        redirect_resp.has_redirect_location = True
        redirect_resp.headers = {"location": "https://example.com/new-page"}
        redirect_resp.status_code = 301

        final_resp = MagicMock(spec=httpx.Response)
        final_resp.is_redirect = False
        final_resp.has_redirect_location = False
        final_resp.status_code = 200
        final_resp.text = "<html><head><title>New</title></head><body><p>Content here</p></body></html>"
        final_resp.url = httpx.URL("https://example.com/new-page")

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.side_effect = [redirect_resp, final_resp]

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _PATCH_SSRF:
            result = await fetch_page(ctx, "https://example.com/old-page")

        assert client.get.call_count == 2
        assert "Page: New" in result

    @pytest.mark.asyncio
    async def test_follows_www_to_non_www_redirect(self) -> None:
        """www -> non-www redirects should work when allowed_domain is the root."""
        redirect_resp = MagicMock(spec=httpx.Response)
        redirect_resp.is_redirect = True
        redirect_resp.has_redirect_location = True
        redirect_resp.headers = {"location": "https://example.com/home"}
        redirect_resp.status_code = 301

        final_resp = MagicMock(spec=httpx.Response)
        final_resp.is_redirect = False
        final_resp.has_redirect_location = False
        final_resp.status_code = 200
        final_resp.text = (
            "<html><head><title>Home</title></head><body><p>Welcome</p></body></html>"
        )
        final_resp.url = httpx.URL("https://example.com/home")

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.side_effect = [redirect_resp, final_resp]

        # allowed_domain is root (as _run_website_agent now strips www.)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _PATCH_SSRF:
            result = await fetch_page(ctx, "https://www.example.com/")

        assert client.get.call_count == 2
        assert "Page: Home" in result

    @pytest.mark.asyncio
    async def test_max_redirects_exceeded(self) -> None:
        """Exceeding MAX_REDIRECTS should return an error."""
        redirect_resp = MagicMock(spec=httpx.Response)
        redirect_resp.is_redirect = True
        redirect_resp.has_redirect_location = True
        redirect_resp.headers = {"location": "https://example.com/loop"}
        redirect_resp.status_code = 302

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = redirect_resp

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _PATCH_SSRF:
            result = await fetch_page(ctx, "https://example.com/start")

        assert "too many redirects" in result
        assert client.get.call_count == MAX_REDIRECTS


# ---------------------------------------------------------------------------
# browse_page — SSRF tests
# ---------------------------------------------------------------------------


class TestBrowsePageSSRF:
    @pytest.mark.asyncio
    async def test_blocks_initial_ssrf(self) -> None:
        """browse_page should block a URL that resolves to a private IP."""
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with patch(
            "polar.organization_review.collectors.website._resolve_and_validate_ip",
            new_callable=AsyncMock,
            side_effect=SSRFBlockedError("resolves to private IP 10.0.0.1"),
        ):
            result = await browse_page(ctx, "https://example.com/")

        assert "private IP" in result
        assert deps.pages_navigated == 0

    @pytest.mark.asyncio
    async def test_detects_post_navigation_off_origin_redirect(self) -> None:
        """browse_page should detect when the browser ended up on a different domain."""
        mock_page = AsyncMock()
        mock_page.goto = AsyncMock(return_value=MagicMock(status=200))
        mock_page.wait_for_load_state = AsyncMock()
        mock_page.wait_for_timeout = AsyncMock()
        mock_page.url = "https://evil.com/phished"  # JS redirect happened

        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        deps._browser_page = mock_page
        ctx = MagicMock()
        ctx.deps = deps

        with _PATCH_SSRF:
            result = await browse_page(ctx, "https://example.com/")

        assert "off-origin" in result
        assert "evil.com" in result


# ---------------------------------------------------------------------------
# Playwright route interceptor
# ---------------------------------------------------------------------------


class TestPlaywrightRouteInterceptor:
    @pytest.mark.asyncio
    async def test_route_installed_on_page(self) -> None:
        """get_browser_page should install the route handler."""
        mock_page = AsyncMock()
        mock_context = AsyncMock()
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        mock_pw = AsyncMock()
        mock_pw.chromium.launch.return_value = mock_browser

        with patch(
            "polar.organization_review.collectors.website.async_playwright"
        ) as mock_apw:
            mock_apw.return_value.start = AsyncMock(return_value=mock_pw)

            client = AsyncMock(spec=httpx.AsyncClient)
            deps = WebsiteDeps(client=client, allowed_domain="example.com")
            page = await deps.get_browser_page()

        assert page is mock_page
        mock_page.route.assert_called_once()
        call_args = mock_page.route.call_args[0]
        assert call_args[0] == "**/*"
        assert callable(call_args[1])

    @pytest.mark.asyncio
    async def test_blocks_off_origin_document_request(self) -> None:
        """Route handler should block document requests to different domains."""
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")

        # Capture the handler
        mock_page = AsyncMock()
        handler: dict[str, Callable[[Any], Awaitable[Any]]] = {}

        async def capture_route(pattern: str, h: Callable[[Any], Awaitable[Any]]) -> None:
            handler["handler"] = h

        mock_page.route = capture_route
        await deps._install_request_interceptor(mock_page)

        route = AsyncMock()
        route.request.url = "https://evil.com/page"
        route.request.resource_type = "document"

        with _PATCH_SSRF:
            await handler["handler"](route)

        route.abort.assert_called_once_with("blockedbyclient")

    @pytest.mark.asyncio
    async def test_allows_cdn_subresources(self) -> None:
        """Route handler should allow image/script/stylesheet from CDN domains."""
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")

        mock_page = AsyncMock()
        handler: dict[str, Callable[[Any], Awaitable[Any]]] = {}

        async def capture_route(pattern: str, h: Callable[[Any], Awaitable[Any]]) -> None:
            handler["handler"] = h

        mock_page.route = capture_route
        await deps._install_request_interceptor(mock_page)

        route = AsyncMock()
        route.request.url = "https://cdn.jsdelivr.net/some-lib.js"
        route.request.resource_type = "script"

        with _PATCH_SSRF:
            await handler["handler"](route)

        route.continue_.assert_called_once()
        route.abort.assert_not_called()

    @pytest.mark.asyncio
    async def test_blocks_ssrf_on_any_resource_type(self) -> None:
        """Route handler should block any request resolving to a private IP."""
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")

        mock_page = AsyncMock()
        handler: dict[str, Callable[[Any], Awaitable[Any]]] = {}

        async def capture_route(pattern: str, h: Callable[[Any], Awaitable[Any]]) -> None:
            handler["handler"] = h

        mock_page.route = capture_route
        await deps._install_request_interceptor(mock_page)

        route = AsyncMock()
        route.request.url = "https://example.com/api/data"
        route.request.resource_type = "image"

        with patch(
            "polar.organization_review.collectors.website._resolve_and_validate_ip",
            new_callable=AsyncMock,
            side_effect=SSRFBlockedError("private IP"),
        ):
            await handler["handler"](route)

        route.abort.assert_called_once_with("blockedbyclient")
