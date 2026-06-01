"""Thin wrapper around the Firecrawl Cloud `/scrape` endpoint.

Firecrawl renders JavaScript, evades bot/Cloudflare blocks, and uses proxies
server-side, so it replaces the in-house headless Chromium (Playwright) used by
the organization-review website collector. The browser egress is now Firecrawl's
network rather than ours.
"""

from __future__ import annotations

import functools
from dataclasses import dataclass
from typing import TYPE_CHECKING

import structlog

from polar.config import settings

if TYPE_CHECKING:
    from firecrawl import AsyncFirecrawl

log = structlog.get_logger(__name__)

# Firecrawl expresses both of these in milliseconds. `wait_for` gives JS-heavy
# SPAs a moment to hydrate; `timeout` caps a single scrape. Kept well under the
# website collector's 90s OVERALL_TIMEOUT_S budget.
_SCRAPE_WAIT_FOR_MS = 2_000
_SCRAPE_TIMEOUT_MS = 30_000


@dataclass
class ScrapeResult:
    """Normalized result of a Firecrawl scrape."""

    markdown: str
    url: str
    """Final URL after any HTTP/JS/meta-refresh redirects."""
    status_code: int | None
    title: str | None


@functools.cache
def _get_client() -> AsyncFirecrawl:
    """Lazily build a singleton Firecrawl client.

    Imported lazily (and cached) so that importing this module — or running the
    collector with the Playwright scraper selected — never requires the
    Firecrawl SDK to be configured. Mirrors the `_get_website_agent` pattern.
    """
    from firecrawl import AsyncFirecrawl

    api_key = settings.FIRECRAWL_API_KEY
    if not api_key:
        raise RuntimeError("FIRECRAWL_API_KEY is not configured")
    return AsyncFirecrawl(api_key=api_key)


async def scrape_markdown(url: str) -> ScrapeResult:
    """Scrape a URL via Firecrawl Cloud and return its main-content markdown.

    Renders JavaScript and follows redirects server-side. Raises on transport
    or API errors — callers map those onto their own error contracts.
    """
    client = _get_client()
    doc = await client.scrape(
        url,
        formats=["markdown"],
        only_main_content=True,
        wait_for=_SCRAPE_WAIT_FOR_MS,
        timeout=_SCRAPE_TIMEOUT_MS,
    )

    # The SDK snake_cases the camelCase API. `metadata.url` is the post-redirect
    # final URL; `metadata.source_url` is the URL we requested. Fall through both
    # to the requested URL so callers always get a usable value.
    metadata = doc.metadata
    final_url = url
    status_code: int | None = None
    title: str | None = None
    if metadata is not None:
        final_url = metadata.url or metadata.source_url or url
        status_code = metadata.status_code
        title = metadata.title

    return ScrapeResult(
        markdown=doc.markdown or "",
        url=final_url,
        status_code=status_code,
        title=title,
    )
