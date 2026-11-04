import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic_ai.models.test import TestModel

from polar.config import settings
from polar.organization_review.collectors.firecrawl_client import ScrapeResult
from polar.organization_review.collectors.website import (
    MAX_CHARS_PER_PAGE,
    MAX_PAGES,
    WebsiteDeps,
    _build_tool_response,
    _get_website_agent,
    _is_allowed_origin,
    browse_page,
    collect_website_data,
)
from polar.organization_review.schemas import WebsiteData


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


class TestGetWebsiteAgent:
    def test_uses_organization_review_model(self) -> None:
        _get_website_agent.cache_clear()
        try:
            with patch.object(
                settings,
                "get_pydantic_gateway_model",
                return_value=(TestModel(), "openai", "gpt-6.1-sol"),
            ) as get_model:
                _, model_provider, model_name = _get_website_agent()

            get_model.assert_called_once_with(
                settings.PYDANTIC_AI_GATEWAY_ORGANIZATION_REVIEW_MODEL
            )
            assert (model_provider, model_name) == ("openai", "gpt-6.1-sol")
        finally:
            _get_website_agent.cache_clear()


class TestCollectWebsiteData:
    @pytest.mark.anyio
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

    @pytest.mark.anyio
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

    @pytest.mark.anyio
    async def test_timeout_returns_error_data(self) -> None:
        async def slow_agent(url: str, **kwargs: object) -> WebsiteData:
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

    @pytest.mark.anyio
    async def test_exception_returns_error_data(self) -> None:
        with patch(
            "polar.organization_review.collectors.website._run_website_agent",
            new_callable=AsyncMock,
            side_effect=RuntimeError("boom"),
        ):
            result = await collect_website_data("https://example.com")

        assert result.scrape_error is not None
        assert "boom" in result.scrape_error


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
    @pytest.mark.anyio
    async def test_successful_scrape(self) -> None:
        deps = WebsiteDeps(allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        result = ScrapeResult(
            markdown="# Welcome\n\nThis is a real business.",
            url="https://example.com/",
            status_code=200,
            title="My Site",
            links=[
                "https://example.com/about",
                "https://example.com/about",
                "https://evil.com/",
                "https://[invalid/",
            ],
        )
        with _patch_scrape_markdown(result) as mock_scrape:
            response = await browse_page(ctx, "https://example.com/")

        mock_scrape.assert_awaited_once_with("https://example.com/", include_links=True)
        assert response.count("https://example.com/about") == 1
        assert "https://evil.com/" not in response
        assert deps.pages_navigated == 1
        assert len(deps.pages_visited) == 1
        page = deps.pages_visited[0]
        assert page.url == "https://example.com/"
        assert page.title == "My Site"
        assert page.method == "browser"
        assert "real business" in page.content
        assert "Page: My Site" in response

    @pytest.mark.anyio
    async def test_rejects_off_origin_url(self) -> None:
        deps = WebsiteDeps(allowed_domain="example.com")
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

    @pytest.mark.anyio
    async def test_respects_page_limit(self) -> None:
        deps = WebsiteDeps(allowed_domain="example.com", pages_navigated=MAX_PAGES)
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

    @pytest.mark.anyio
    async def test_off_origin_final_url_blocked(self) -> None:
        """A JS/HTTP redirect that lands off-origin is rejected via the final URL."""
        deps = WebsiteDeps(allowed_domain="example.com")
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

    @pytest.mark.anyio
    async def test_http_error(self) -> None:
        deps = WebsiteDeps(allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        result = ScrapeResult(
            markdown="", url="https://example.com/missing", status_code=404, title=None
        )
        with _patch_scrape_markdown(result):
            response = await browse_page(ctx, "https://example.com/missing")

        assert "Error: HTTP 404" in response
        assert deps.pages_visited == []

    @pytest.mark.anyio
    async def test_scrape_exception(self) -> None:
        deps = WebsiteDeps(allowed_domain="example.com")
        ctx = MagicMock()
        ctx.deps = deps

        with _patch_scrape_markdown(RuntimeError("firecrawl down")):
            response = await browse_page(ctx, "https://example.com/")

        assert "Error navigating" in response
        assert deps.pages_visited == []

    @pytest.mark.anyio
    async def test_content_truncation(self) -> None:
        deps = WebsiteDeps(allowed_domain="example.com")
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
