import uuid
from datetime import UTC, date, datetime, timedelta
from unittest.mock import AsyncMock
from zoneinfo import ZoneInfo

import pytest

from polar.insights.detectors.base import DetectorContext, confidence_for_sample
from polar.insights.detectors.mrr import MRRGrowthDetector
from polar.insights.schemas import ConfidenceLevel, InsightCategory
from polar.metrics.schemas import MetricsResponse


def _response(mrr: list[float], active_subscriptions: list[float]) -> MetricsResponse:
    """Build a daily MetricsResponse from raw per-period series."""
    base = datetime(2026, 1, 1, tzinfo=UTC)
    periods = [
        {
            "timestamp": base + timedelta(days=i),
            "monthly_recurring_revenue": mrr_value,
            "active_subscriptions": active_subscriptions[i],
        }
        for i, mrr_value in enumerate(mrr)
    ]
    return MetricsResponse.model_validate(
        {"periods": periods, "totals": {}, "metrics": {}}
    )


def _context(response: MetricsResponse) -> DetectorContext:
    ctx = DetectorContext(
        session=None,  # type: ignore[arg-type]
        auth_subject=None,  # type: ignore[arg-type]
        organization_id=uuid.uuid4(),
        timezone=ZoneInfo("UTC"),
        today=date(2026, 2, 6),
        redis=None,
        metrics_service=None,  # type: ignore[arg-type]
    )
    # Shadow the bound method so the detector reads our fixture instead of the API.
    ctx.metrics = AsyncMock(return_value=response)  # type: ignore[method-assign]
    return ctx


class TestConfidenceForSample:
    def test_below_minimum_is_suppressed(self) -> None:
        assert confidence_for_sample(4) is None

    def test_levels(self) -> None:
        assert confidence_for_sample(5) is ConfidenceLevel.low
        assert confidence_for_sample(50) is ConfidenceLevel.medium
        assert confidence_for_sample(500) is ConfidenceLevel.high


@pytest.mark.asyncio
class TestMRRGrowthDetector:
    async def test_fires_on_material_growth(self) -> None:
        # 36 daily periods: baseline (index 5) = $1000, latest (index 35) = $1200.
        mrr = [100_000.0] * 6 + [110_000.0] * 29 + [120_000.0]
        subs = [50.0] * 36

        insight = await MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is not None
        assert insight.category is InsightCategory.revenue
        assert insight.confidence is ConfidenceLevel.medium
        assert "grew 20%" in insight.title
        assert insight.detector_id == "mrr_mom"
        # Deterministic key: detector:org:period_bucket (monthly).
        assert insight.id.endswith(":2026-02")
        assert insight.primary_action is not None

    async def test_suppressed_when_sample_too_small(self) -> None:
        mrr = [100_000.0] * 6 + [110_000.0] * 29 + [120_000.0]
        subs = [3.0] * 36  # below the minimum sample threshold

        insight = await MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is None

    async def test_no_insight_on_immaterial_change(self) -> None:
        # ~2% change, under the 5% materiality bar.
        mrr = [100_000.0] * 35 + [102_000.0]
        subs = [50.0] * 36

        insight = await MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is None

    async def test_no_insight_when_window_too_short(self) -> None:
        mrr = [100_000.0] * 10  # fewer than lookback + 1 periods
        subs = [50.0] * 10

        insight = await MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is None
