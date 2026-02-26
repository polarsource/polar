import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from polar.organization_review.collectors.website import (
    MAX_CHARS_PER_PAGE,
    MAX_PAGES,
    WebsiteDeps,
    _build_tool_response,
    _extract_links_from_html,
    _is_allowed_origin,
    collect_website_data,
    fetch_page,
)
from polar.organization_review.schemas import WebsiteData

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

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

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

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

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

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

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
