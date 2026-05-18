from polar.organization_review.analyzer import _render_scraped_site
from polar.organization_review.schemas import WebsiteData, WebsitePage


def _make_website_data(
    *,
    summary: str | None = None,
    scrape_error: str | None = None,
    pages: list[WebsitePage] | None = None,
    total_pages_succeeded: int = 0,
) -> WebsiteData:
    return WebsiteData(
        base_url="https://example.com/",
        summary=summary,
        scrape_error=scrape_error,
        pages=pages or [],
        total_pages_succeeded=total_pages_succeeded,
    )


class TestRenderScrapedSite:
    def test_renders_source_line(self) -> None:
        parts: list[str] = []
        _render_scraped_site(
            parts,
            _make_website_data(summary="hello", total_pages_succeeded=3),
            empty_message="nothing here",
        )
        assert parts[0] == "Source: https://example.com/ (3 page(s) scraped)"

    def test_wraps_summary_in_untrusted_block(self) -> None:
        parts: list[str] = []
        _render_scraped_site(
            parts,
            _make_website_data(summary="merchant says hi"),
            empty_message="nothing here",
        )
        # Summary lines must be wrapped so the agent treats them as data.
        assert "<untrusted-merchant-content>" in parts
        assert "merchant says hi" in parts
        assert "</untrusted-merchant-content>" in parts
        open_idx = parts.index("<untrusted-merchant-content>")
        close_idx = parts.index("</untrusted-merchant-content>")
        assert open_idx < parts.index("merchant says hi") < close_idx

    def test_renders_scrape_error(self) -> None:
        parts: list[str] = []
        _render_scraped_site(
            parts,
            _make_website_data(scrape_error="timeout after 90s"),
            empty_message="nothing here",
        )
        assert any("Scrape error: timeout after 90s" in p for p in parts)
        # Empty message must NOT appear when we have a scrape error.
        assert "nothing here" not in parts

    def test_empty_message_only_when_no_pages_and_no_error(self) -> None:
        parts: list[str] = []
        _render_scraped_site(
            parts,
            _make_website_data(),
            empty_message="nothing here",
        )
        assert "nothing here" in parts
        assert "<untrusted-merchant-content>" not in parts

    def test_no_empty_message_when_summary_present(self) -> None:
        parts: list[str] = []
        _render_scraped_site(
            parts,
            _make_website_data(summary="merchant says hi"),
            empty_message="nothing here",
        )
        assert "nothing here" not in parts

    def test_no_empty_message_when_pages_present_but_no_summary(self) -> None:
        """Pages without summary shouldn't trigger the empty fallback either."""
        page = WebsitePage(url="https://example.com/", content="some content")
        parts: list[str] = []
        _render_scraped_site(
            parts,
            _make_website_data(pages=[page], total_pages_succeeded=1),
            empty_message="nothing here",
        )
        assert "nothing here" not in parts
