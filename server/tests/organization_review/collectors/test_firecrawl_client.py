import pytest
from firecrawl.v2 import AsyncFirecrawlClient

from polar.organization_review.collectors.firecrawl_client import get_firecrawl_client


class TestGetFirecrawlClient:
    def test_returns_none_without_api_key(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from polar.config import settings

        monkeypatch.setattr(settings, "FIRECRAWL_API_KEY", None)
        assert get_firecrawl_client() is None

    def test_returns_none_with_empty_api_key(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from polar.config import settings

        monkeypatch.setattr(settings, "FIRECRAWL_API_KEY", "")
        assert get_firecrawl_client() is None

    def test_returns_async_client_with_api_key(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from polar.config import settings

        monkeypatch.setattr(settings, "FIRECRAWL_API_KEY", "fc-test")
        client = get_firecrawl_client()
        assert isinstance(client, AsyncFirecrawlClient)
