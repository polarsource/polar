from datetime import UTC, datetime
from unittest.mock import AsyncMock

import httpx
import pytest
from pydantic_ai.exceptions import (
    ConcurrencyLimitExceeded,
    ModelHTTPError,
    UnexpectedModelBehavior,
    UserError,
)
from pydantic_ai.models.test import TestModel
from pytest_mock import MockerFixture

from polar.config import settings
from polar.organization_review.analyzer import ReviewAnalyzer, _render_scraped_site
from polar.organization_review.schemas import (
    DataSnapshot,
    HistoryData,
    OrganizationData,
    PaymentMetrics,
    PayoutAccountData,
    ProductsData,
    ReviewContext,
    RiskSignalData,
    RiskSignalEntry,
    WebsiteData,
    WebsitePage,
)


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


def _minimal_snapshot() -> DataSnapshot:
    return DataSnapshot(
        context=ReviewContext.SUBMISSION,
        organization=OrganizationData(name="Test Org", slug="test-org"),
        products=ProductsData(),
        account=PayoutAccountData(),
        metrics=PaymentMetrics(),
        history=HistoryData(),
        collected_at=datetime.now(UTC),
    )


@pytest.fixture
def review_analyzer(mocker: MockerFixture) -> ReviewAnalyzer:
    # Stub the gateway model so the agent builds without real gateway creds.
    mocker.patch.object(
        settings,
        "get_pydantic_gateway_model",
        return_value=(TestModel(), "openai", "gpt-test"),
    )
    return ReviewAnalyzer()


def _stub_analyzer_io(
    mocker: MockerFixture,
    review_analyzer: ReviewAnalyzer,
    run_side_effect: BaseException,
) -> None:
    """Patch the heavy I/O around `analyze` so a test can target just the
    exception-handling path: prompt building, AUP file read, and the LLM
    agent call. The mocked `agent.run` raises `run_side_effect`.
    """
    mocker.patch.object(review_analyzer, "_build_prompt", return_value="test-prompt")
    mocker.patch(
        "polar.organization_review.analyzer.fetch_policy_content",
        new=AsyncMock(return_value="test-policy"),
    )
    mocker.patch.object(
        review_analyzer.agent,
        "run",
        new=AsyncMock(side_effect=run_side_effect),
    )


class TestBuildPromptRiskSignals:
    def test_no_section_without_signals(self, review_analyzer: ReviewAnalyzer) -> None:
        prompt = review_analyzer._build_prompt(_minimal_snapshot())
        assert "## External Risk Signals" not in prompt

    def test_renders_signals(self, review_analyzer: ReviewAnalyzer) -> None:
        snapshot = _minimal_snapshot().model_copy(
            update={
                "risk_signals": RiskSignalData(
                    entries=[
                        RiskSignalEntry(
                            source="stripe",
                            type="fraudulent_website",
                            risk_level="elevated",
                            description="Indicators: suspicious_content",
                            created_at=datetime(2026, 7, 1, tzinfo=UTC),
                        ),
                        RiskSignalEntry(
                            source="stripe",
                            type="fraudulent_merchant",
                            risk_level="highest",
                        ),
                    ]
                )
            }
        )

        prompt = review_analyzer._build_prompt(snapshot)

        assert "## External Risk Signals" in prompt
        assert (
            "- [2026-07-01] stripe: fraudulent_website (risk level: elevated)" in prompt
        )
        assert "  Details: Indicators: suspicious_content" in prompt
        assert (
            "- [unknown date] stripe: fraudulent_merchant (risk level: highest)"
            in prompt
        )


@pytest.mark.asyncio
class TestAnalyzeReraisesOnError:
    """ReviewAnalyzer re-raises every non-timeout failure so the Dramatiq
    actor retries it and Sentry captures the final failure. Persisting a
    synthetic DENY here would silently block merchants either on transient
    gateway outages or on deterministic bugs (config/programming errors).
    """

    @pytest.mark.parametrize(
        "exc",
        [
            # Transient classes
            ModelHTTPError(
                status_code=429,
                model_name="gpt-5.5",
                body={"message": "rate limited"},
            ),
            ModelHTTPError(
                status_code=503,
                model_name="gpt-5.5",
                body={"message": "service unavailable"},
            ),
            httpx.ConnectError("connection refused"),
            httpx.ReadTimeout("upstream slow"),
            UnexpectedModelBehavior("output schema violation"),
            ConcurrencyLimitExceeded("backpressure"),
            # Per-run timeout (asyncio.wait_for raises TimeoutError)
            TimeoutError("analysis exceeded 60s"),
            # Deterministic classes (config / programming bugs)
            UserError("invalid tool registration"),
            AttributeError("'NoneType' object has no attribute 'output'"),
            ValueError("bad usage shape"),
        ],
        ids=[
            "model_http_error_429",
            "model_http_error_503",
            "httpx_connect_error",
            "httpx_read_timeout",
            "unexpected_model_behavior",
            "concurrency_limit_exceeded",
            "timeout_error",
            "user_error",
            "attribute_error",
            "value_error",
        ],
    )
    async def test_reraises(
        self,
        mocker: MockerFixture,
        review_analyzer: ReviewAnalyzer,
        exc: BaseException,
    ) -> None:
        _stub_analyzer_io(mocker, review_analyzer, exc)

        with pytest.raises(type(exc)):
            await review_analyzer.analyze(
                _minimal_snapshot(), context=ReviewContext.SUBMISSION
            )
