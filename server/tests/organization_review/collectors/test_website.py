import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from polar.kit.http import SSRFBlockedError
from polar.organization_review.collectors.firecrawl_client import ScrapeResult
from polar.organization_review.collectors.website import (
    MAX_CHARS_PER_PAGE,
    MAX_PAGES,
    MAX_REDIRECTS,
    WebsiteDeps,
    _build_tool_response,
    _extract_links_from_html,
    _is_allowed_origin,
    browse_page,
    collect_website_data,
    fetch_page,
)
from polar.organization_review.schemas import WebsiteData

# Shorthand for patching resolve_and_validate_ip to allow all IPs
_PATCH_SSRF = patch(
    "polar.organization_review.collectors.website.resolve_and_validate_ip",
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

            mock_run.assert_called_once_with(
                "https://example.com",
                organization_id=None,
                organization_slug=None,
            )
            assert result.base_url == "https://example.com"

    @pytest.mark.asyncio
    async def test_strips_trailing_slash(self) -> None:
        with patch(
            "polar.organization_review.collectors.website._run_website_agent",
            new_callable=AsyncMock,
        ) as mock_run:
            mock_run.return_value = WebsiteData(base_url="https://example.com")

            await collect_website_data("https://example.com/")

            mock_run.assert_called_once_with(
                "https://example.com",
                organization_id=None,
                organization_slug=None,
            )

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
            "polar.organization_review.collectors.website.resolve_and_validate_ip",
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
            "polar.organization_review.collectors.website.resolve_and_validate_ip",
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
# browse_page — Firecrawl rendering
# ---------------------------------------------------------------------------


def _patch_scrape_markdown(result: ScrapeResult | Exception) -> Any:
    """Patch scrape_markdown to return a ScrapeResult or raise an exception."""
    if isinstance(result, Exception):
        return patch(
            "polar.organization_review.collectors.website.scrape_markdown",
            new_callable=AsyncMock,
            side_effect=result,
        )
    return patch(
        "polar.organization_review.collectors.website.scrape_markdown",
        new_callable=AsyncMock,
        return_value=result,
    )


class TestBrowsePageFirecrawl:
    @pytest.mark.asyncio
    async def test_successful_scrape(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        result = ScrapeResult(
            markdown="# Welcome\n\nThis is a real business.",
            url="https://example.com/",
            status_code=200,
            title="My Site",
        )
        with _patch_scrape_markdown(result):
            response = await browse_page(ctx, "https://example.com/")

        assert deps.pages_navigated == 1
        assert len(deps.pages_visited) == 1
        page = deps.pages_visited[0]
        assert page.url == "https://example.com/"
        assert page.title == "My Site"
        assert page.method == "browser"
        assert "real business" in page.content
        assert "Page: My Site" in response

    @pytest.mark.asyncio
    async def test_rejects_off_origin_url(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _patch_scrape_markdown(
            ScrapeResult(
                markdown="x", url="https://evil.com/", status_code=200, title=None
            )
        ) as mock_scrape:
            response = await browse_page(ctx, "https://evil.com/steal")

        assert "off-origin" in response
        assert deps.pages_navigated == 0
        mock_scrape.assert_not_called()

    @pytest.mark.asyncio
    async def test_respects_page_limit(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(
            client=client, allowed_domain="example.com", pages_navigated=MAX_PAGES
        )
        ctx = MagicMock()
        ctx.deps = deps

        with _patch_scrape_markdown(
            ScrapeResult(
                markdown="x", url="https://example.com/", status_code=200, title=None
            )
        ) as mock_scrape:
            response = await browse_page(ctx, "https://example.com/page")

        assert "Page limit reached" in response
        mock_scrape.assert_not_called()

    @pytest.mark.asyncio
    async def test_off_origin_final_url_blocked(self) -> None:
        """A JS/HTTP redirect that lands off-origin is rejected via the final URL."""
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        result = ScrapeResult(
            markdown="phish", url="https://evil.com/landing", status_code=200, title="X"
        )
        with _patch_scrape_markdown(result):
            response = await browse_page(ctx, "https://example.com/")

        assert "off-origin" in response
        assert "https://evil.com/landing" in response
        assert deps.pages_visited == []

    @pytest.mark.asyncio
    async def test_http_error(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        result = ScrapeResult(
            markdown="", url="https://example.com/missing", status_code=404, title=None
        )
        with _patch_scrape_markdown(result):
            response = await browse_page(ctx, "https://example.com/missing")

        assert "Error: HTTP 404" in response
        assert deps.pages_visited == []

    @pytest.mark.asyncio
    async def test_scrape_exception(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _patch_scrape_markdown(RuntimeError("firecrawl down")):
            response = await browse_page(ctx, "https://example.com/")

        assert "Error navigating" in response
        assert deps.pages_visited == []

    @pytest.mark.asyncio
    async def test_content_truncation(self) -> None:
        client = AsyncMock(spec=httpx.AsyncClient)
        deps = WebsiteDeps(client=client, allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        long_markdown = "x" * (MAX_CHARS_PER_PAGE + 5_000)
        result = ScrapeResult(
            markdown=long_markdown,
            url="https://example.com/",
            status_code=200,
            title="Big",
        )
        with _patch_scrape_markdown(result):
            response = await browse_page(ctx, "https://example.com/")

        assert deps.pages_visited[0].content_truncated is True
        assert len(deps.pages_visited[0].content) <= MAX_CHARS_PER_PAGE
        assert "(content truncated)" in response
