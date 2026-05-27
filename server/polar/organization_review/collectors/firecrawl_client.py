"""Firecrawl client factory.

Wraps the `firecrawl-py` SDK's `AsyncFirecrawlClient` so the rest of the
collector code can stay agnostic of construction details and feature-flag
the integration via `FIRECRAWL_API_KEY`.
"""

from __future__ import annotations

from firecrawl.v2 import AsyncFirecrawlClient

from polar.config import settings

# Per-call defaults. The SDK retries on transport errors and 502s with
# exponential backoff (factor*2**attempt) — these knobs gate the upper
# bound on time spent retrying.
_MAX_RETRIES = 3
_BACKOFF_FACTOR = 0.5


def get_firecrawl_client() -> AsyncFirecrawlClient | None:
    """Return a configured client, or None when no API key is set."""
    api_key = settings.FIRECRAWL_API_KEY
    if not api_key:
        return None
    return AsyncFirecrawlClient(
        api_key=api_key,
        api_url=settings.FIRECRAWL_API_URL,
        max_retries=_MAX_RETRIES,
        backoff_factor=_BACKOFF_FACTOR,
    )
