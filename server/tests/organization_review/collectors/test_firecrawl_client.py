from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from polar.config import settings
from polar.organization_review.collectors import firecrawl_client
from polar.organization_review.collectors.firecrawl_client import (
    ScrapeResult,
    scrape_markdown,
)


def _doc(
    *,
    markdown: str | None = None,
    url: str | None = None,
    source_url: str | None = None,
    status_code: int | None = None,
    title: str | None = None,
    with_metadata: bool = True,
) -> SimpleNamespace:
    """Build a stand-in for firecrawl.v2.types.Document."""
    metadata = (
        SimpleNamespace(
            url=url, source_url=source_url, status_code=status_code, title=title
        )
        if with_metadata
        else None
    )
    return SimpleNamespace(markdown=markdown, metadata=metadata)


def _patch_client(doc: SimpleNamespace) -> Any:
    client = AsyncMock()
    client.scrape = AsyncMock(return_value=doc)
    return patch.object(firecrawl_client, "_get_client", return_value=client)


class TestScrapeMarkdown:
    @pytest.mark.asyncio
    async def test_prefers_metadata_url_as_final_url(self) -> None:
        """metadata.url is the post-redirect final URL and wins over source_url."""
        doc = _doc(
            markdown="# Hi",
            url="https://final.example.com/",
            source_url="https://requested.example.com/",
            status_code=200,
            title="Title",
        )
        with _patch_client(doc) as get_client:
            result = await scrape_markdown("https://requested.example.com/")

        assert isinstance(result, ScrapeResult)
        assert result.url == "https://final.example.com/"
        assert result.markdown == "# Hi"
        assert result.status_code == 200
        assert result.title == "Title"

        client = get_client.return_value
        client.scrape.assert_awaited_once()
        args, kwargs = client.scrape.call_args
        assert args[0] == "https://requested.example.com/"
        assert kwargs["formats"] == ["markdown"]
        assert kwargs["only_main_content"] is True
        assert "wait_for" in kwargs
        assert "timeout" in kwargs

    @pytest.mark.asyncio
    async def test_falls_back_to_source_url_when_url_missing(self) -> None:
        doc = _doc(
            markdown="x",
            url=None,
            source_url="https://source.example.com/",
            status_code=200,
        )
        with _patch_client(doc):
            result = await scrape_markdown("https://requested.example.com/")

        assert result.url == "https://source.example.com/"

    @pytest.mark.asyncio
    async def test_falls_back_to_requested_url_when_metadata_missing(self) -> None:
        doc = _doc(markdown="x", with_metadata=False)
        with _patch_client(doc):
            result = await scrape_markdown("https://requested.example.com/")

        assert result.url == "https://requested.example.com/"
        assert result.status_code is None
        assert result.title is None

    @pytest.mark.asyncio
    async def test_none_markdown_becomes_empty_string(self) -> None:
        doc = _doc(markdown=None, url="https://example.com/", status_code=200)
        with _patch_client(doc):
            result = await scrape_markdown("https://example.com/")

        assert result.markdown == ""

    @pytest.mark.asyncio
    async def test_missing_api_key_raises(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """_get_client raises a clear error when the key isn't configured."""
        firecrawl_client._get_client.cache_clear()
        monkeypatch.setattr(settings, "FIRECRAWL_API_KEY", None)
        try:
            with pytest.raises(RuntimeError, match="FIRECRAWL_API_KEY"):
                await scrape_markdown("https://example.com/")
        finally:
            firecrawl_client._get_client.cache_clear()
