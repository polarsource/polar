import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from polar.compass.detectors.arpu import ARPUMovementDetector
from polar.compass.detectors.base import DetectorContext, confidence_for_sample
from polar.compass.detectors.churn import ChurnSpikeDetector
from polar.compass.detectors.conversion import CheckoutConversionDetector
from polar.compass.detectors.cost_per_user import CostPerUserDetector
from polar.compass.detectors.margin import GrossMarginDetector
from polar.compass.detectors.mrr import MRRGrowthDetector
from polar.compass.detectors.subscribers import SubscriberGrowthDetector
from polar.compass.detectors.trials import TrialConversionDetector
from polar.compass.keys import build_insight_key, parse_insight_key
from polar.compass.schemas import ConfidenceLevel, InsightCategory, InsightSeverity
from polar.metrics.schemas import MetricsResponse


def _response_from(**series: list[float]) -> MetricsResponse:
    """Build a daily MetricsResponse from named per-period metric series."""
    length = max(len(values) for values in series.values())
    base = datetime(2026, 1, 1, tzinfo=UTC)
    periods = [
        {
            "timestamp": base + timedelta(days=i),
            **{slug: values[i] for slug, values in series.items()},
        }
        for i in range(length)
    ]
    return MetricsResponse.model_validate(
        {"periods": periods, "totals": {}, "metrics": {}}
    )


def _response(mrr: list[float], active_subscriptions: list[float]) -> MetricsResponse:
    """Build a daily MetricsResponse from raw per-period series."""
    return _response_from(
        monthly_recurring_revenue=mrr, active_subscriptions=active_subscriptions
    )


def _context(response: MetricsResponse) -> DetectorContext:
    return DetectorContext(
        organization_id=uuid.uuid4(),
        timezone=ZoneInfo("UTC"),
        today=date(2026, 2, 6),
        metrics=response,
    )


class TestConfidenceForSample:
    def test_below_minimum_is_suppressed(self) -> None:
        assert confidence_for_sample(4) is None

    def test_levels(self) -> None:
        assert confidence_for_sample(5) is ConfidenceLevel.low
        assert confidence_for_sample(50) is ConfidenceLevel.medium
        assert confidence_for_sample(500) is ConfidenceLevel.high


class TestInsightKeys:
    def test_round_trip(self) -> None:
        organization_id = uuid.uuid4()
        key = build_insight_key("mrr_mom", organization_id, "2026-02")

        parsed = parse_insight_key(key)

        assert parsed.detector_id == "mrr_mom"
        assert parsed.organization_id == organization_id
        assert parsed.period_bucket == "2026-02"

    def test_separator_in_detector_id_rejected(self) -> None:
        with pytest.raises(ValueError, match="key separator"):
            build_insight_key("mrr:mom", uuid.uuid4(), "2026-02")

    @pytest.mark.parametrize(
        "key",
        [
            "nope",
            "mrr_mom:not-a-uuid:2026-02",
            # Fixed UUIDs, not `uuid.uuid4()`: parametrize values are evaluated at
            # collection time, so a random value makes each pytest-xdist worker
            # collect a different test id and the run aborts on the mismatch.
            "mrr_mom:2b1e4f0a-0000-4000-8000-000000000000:",
            ":2b1e4f0a-0000-4000-8000-000000000000:2026-02",
        ],
    )
    def test_malformed_keys_rejected(self, key: str) -> None:
        with pytest.raises(ValueError, match="Malformed insight key"):
            parse_insight_key(key)


class TestMRRGrowthDetector:
    def test_fires_on_material_growth(self) -> None:
        # 36 daily periods: baseline (index 5) = $1000, latest (index 35) = $1200.
        mrr = [100_000.0] * 6 + [110_000.0] * 29 + [120_000.0]
        subs = [50.0] * 36

        insight = MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is not None
        assert insight.category is InsightCategory.revenue
        assert insight.confidence is ConfidenceLevel.medium
        # Growth is good news: informational, not alarming.
        assert insight.severity is InsightSeverity.info
        assert "grew 20%" in insight.title
        assert insight.detector_id == "mrr_mom"
        # Deterministic key: detector:org:period_bucket (monthly).
        assert insight.id.endswith(":2026-02")
        assert insight.primary_action is not None

    def test_decline_is_a_warning(self) -> None:
        # Mirror of the growth case: $1200 baseline down to $1000.
        mrr = [120_000.0] * 6 + [110_000.0] * 29 + [100_000.0]
        subs = [50.0] * 36

        insight = MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is not None
        assert insight.severity is InsightSeverity.warning
        assert "fell 17%" in insight.title

    def test_suppressed_when_sample_too_small(self) -> None:
        mrr = [100_000.0] * 6 + [110_000.0] * 29 + [120_000.0]
        subs = [3.0] * 36  # below the minimum sample threshold

        insight = MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is None

    def test_no_insight_on_immaterial_change(self) -> None:
        # ~2% change, under the 5% materiality bar.
        mrr = [100_000.0] * 35 + [102_000.0]
        subs = [50.0] * 36

        insight = MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is None

    def test_no_insight_when_window_too_short(self) -> None:
        mrr = [100_000.0] * 10  # fewer than lookback + 1 periods
        subs = [50.0] * 10

        insight = MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is None


class TestSubscriberGrowthDetector:
    def test_fires_on_material_growth(self) -> None:
        # baseline (index 5) = 10 subs, latest (index 35) = 16 subs → +60%.
        subs = [10.0] * 6 + [12.0] * 29 + [16.0]

        insight = SubscriberGrowthDetector().evaluate(
            _context(_response_from(active_subscriptions=subs))
        )

        assert insight is not None
        assert insight.category is InsightCategory.growth
        assert insight.severity is InsightSeverity.info
        assert "grew 60%" in insight.title
        assert "16 active subscriptions" in insight.body
        assert insight.detector_id == "subscribers_mom"

    def test_decline_is_a_warning(self) -> None:
        subs = [16.0] * 6 + [12.0] * 29 + [10.0]

        insight = SubscriberGrowthDetector().evaluate(
            _context(_response_from(active_subscriptions=subs))
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.warning
        assert "shrank" in insight.title

    def test_suppressed_when_sample_too_small(self) -> None:
        subs = [2.0] * 6 + [3.0] * 29 + [4.0]

        insight = SubscriberGrowthDetector().evaluate(
            _context(_response_from(active_subscriptions=subs))
        )

        assert insight is None


class TestARPUMovementDetector:
    def test_fires_when_arpu_falls(self) -> None:
        # ARPU (in cents) dilutes from $250 to $194 as cheaper plans join.
        arpu = [25_000.0] * 6 + [22_000.0] * 29 + [19_400.0]
        subs = [50.0] * 36

        insight = ARPUMovementDetector().evaluate(
            _context(
                _response_from(average_revenue_per_user=arpu, active_subscriptions=subs)
            )
        )

        assert insight is not None
        assert insight.category is InsightCategory.revenue
        assert insight.severity is InsightSeverity.warning
        assert "fell 22%" in insight.title
        assert insight.detector_id == "arpu_mom"

    def test_growth_is_an_opportunity(self) -> None:
        arpu = [19_400.0] * 6 + [22_000.0] * 29 + [25_000.0]
        subs = [50.0] * 36

        insight = ARPUMovementDetector().evaluate(
            _context(
                _response_from(average_revenue_per_user=arpu, active_subscriptions=subs)
            )
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.opportunity
        assert "grew" in insight.title

    def test_no_insight_on_immaterial_change(self) -> None:
        arpu = [25_000.0] * 35 + [25_500.0]
        subs = [50.0] * 36

        insight = ARPUMovementDetector().evaluate(
            _context(
                _response_from(average_revenue_per_user=arpu, active_subscriptions=subs)
            )
        )

        assert insight is None


class TestChurnSpikeDetector:
    def test_fires_on_material_churn(self) -> None:
        # 66 daily periods; 4 cancellations land inside the trailing 30 days.
        churned = [0.0] * 62 + [2.0, 0.0, 1.0, 1.0]
        subs = [50.0] * 66

        insight = ChurnSpikeDetector().evaluate(
            _context(
                _response_from(churned_subscriptions=churned, active_subscriptions=subs)
            )
        )

        assert insight is not None
        assert insight.category is InsightCategory.retention
        assert insight.severity is InsightSeverity.warning
        assert "4 subscriptions churned" in insight.title
        assert insight.detector_id == "churn_spike"

    def test_high_rate_is_critical(self) -> None:
        # 12 cancellations against ~50 active → >10% → critical.
        churned = [0.0] * 54 + [1.0] * 12
        subs = [50.0] * 66

        insight = ChurnSpikeDetector().evaluate(
            _context(
                _response_from(churned_subscriptions=churned, active_subscriptions=subs)
            )
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.critical

    def test_no_insight_when_churn_immaterial(self) -> None:
        # A single cancellation against a large base is under the 3% bar.
        churned = [0.0] * 65 + [1.0]
        subs = [500.0] * 66

        insight = ChurnSpikeDetector().evaluate(
            _context(
                _response_from(churned_subscriptions=churned, active_subscriptions=subs)
            )
        )

        assert insight is None

    def test_no_insight_without_recent_churn(self) -> None:
        # Cancellations exist, but all fall before the trailing window.
        churned = [1.0] * 30 + [0.0] * 36
        subs = [50.0] * 66

        insight = ChurnSpikeDetector().evaluate(
            _context(
                _response_from(churned_subscriptions=churned, active_subscriptions=subs)
            )
        )

        assert insight is None


class TestTrialConversionDetector:
    def test_fires_on_material_trial_pipeline(self) -> None:
        trial_mrr = [0.0] * 35 + [100_000.0]
        mrr = [900_000.0] * 36
        subs = [50.0] * 36

        insight = TrialConversionDetector().evaluate(
            _context(
                _response_from(
                    trial_monthly_recurring_revenue=trial_mrr,
                    monthly_recurring_revenue=mrr,
                    active_subscriptions=subs,
                )
            )
        )

        assert insight is not None
        assert insight.category is InsightCategory.growth
        assert insight.severity is InsightSeverity.opportunity
        assert "trialing MRR could convert" in insight.title
        assert insight.detector_id == "trial_conversion"

    def test_no_insight_without_trial_mrr(self) -> None:
        trial_mrr = [0.0] * 36
        mrr = [900_000.0] * 36
        subs = [50.0] * 36

        insight = TrialConversionDetector().evaluate(
            _context(
                _response_from(
                    trial_monthly_recurring_revenue=trial_mrr,
                    monthly_recurring_revenue=mrr,
                    active_subscriptions=subs,
                )
            )
        )

        assert insight is None

    def test_no_insight_when_pipeline_immaterial(self) -> None:
        # Trialing MRR is well under 5% of run rate.
        trial_mrr = [0.0] * 35 + [10_000.0]
        mrr = [900_000.0] * 36
        subs = [50.0] * 36

        insight = TrialConversionDetector().evaluate(
            _context(
                _response_from(
                    trial_monthly_recurring_revenue=trial_mrr,
                    monthly_recurring_revenue=mrr,
                    active_subscriptions=subs,
                )
            )
        )

        assert insight is None


class TestGrossMarginDetector:
    def test_fires_when_margin_is_thin(self) -> None:
        margin = [0.55] * 36  # stable but under the 70% healthy bar
        subs = [50.0] * 36

        insight = GrossMarginDetector().evaluate(
            _context(
                _response_from(
                    gross_margin_percentage=margin, active_subscriptions=subs
                )
            )
        )

        assert insight is not None
        assert insight.category is InsightCategory.cost
        assert insight.severity is InsightSeverity.warning
        assert "Gross margin is 55%" in insight.title
        assert insight.detector_id == "gross_margin"

    def test_compression_is_flagged(self) -> None:
        margin = [0.80] * 6 + [0.75] * 29 + [0.68]
        subs = [50.0] * 36

        insight = GrossMarginDetector().evaluate(
            _context(
                _response_from(
                    gross_margin_percentage=margin, active_subscriptions=subs
                )
            )
        )

        assert insight is not None
        assert "compressed to 68%" in insight.title
        assert insight.severity is InsightSeverity.warning

    def test_deep_loss_is_critical(self) -> None:
        margin = [0.30] * 36
        subs = [50.0] * 36

        insight = GrossMarginDetector().evaluate(
            _context(
                _response_from(
                    gross_margin_percentage=margin, active_subscriptions=subs
                )
            )
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.critical

    def test_improvement_is_an_opportunity(self) -> None:
        margin = [0.78] * 6 + [0.85] * 29 + [0.90]
        subs = [50.0] * 36

        insight = GrossMarginDetector().evaluate(
            _context(
                _response_from(
                    gross_margin_percentage=margin, active_subscriptions=subs
                )
            )
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.opportunity
        assert "improved to 90%" in insight.title

    def test_silent_without_cost_data(self) -> None:
        # No Tinybird cost/revenue data resolves margin to 0 — stay quiet.
        margin = [0.0] * 36
        subs = [50.0] * 36

        insight = GrossMarginDetector().evaluate(
            _context(
                _response_from(
                    gross_margin_percentage=margin, active_subscriptions=subs
                )
            )
        )

        assert insight is None

    def test_no_insight_when_healthy_and_stable(self) -> None:
        margin = [0.88] * 36
        subs = [50.0] * 36

        insight = GrossMarginDetector().evaluate(
            _context(
                _response_from(
                    gross_margin_percentage=margin, active_subscriptions=subs
                )
            )
        )

        assert insight is None


class TestCostPerUserDetector:
    def test_fires_when_cost_rises(self) -> None:
        # Cost per user (cents) climbs from $2.00 to $3.00.
        cpu = [200.0] * 6 + [250.0] * 29 + [300.0]
        subs = [50.0] * 36

        insight = CostPerUserDetector().evaluate(
            _context(_response_from(cost_per_user=cpu, active_subscriptions=subs))
        )

        assert insight is not None
        assert insight.category is InsightCategory.cost
        assert insight.severity is InsightSeverity.warning
        assert "rose 50%" in insight.title
        assert insight.detector_id == "cost_per_user"

    def test_decline_is_an_opportunity(self) -> None:
        cpu = [300.0] * 6 + [250.0] * 29 + [200.0]
        subs = [50.0] * 36

        insight = CostPerUserDetector().evaluate(
            _context(_response_from(cost_per_user=cpu, active_subscriptions=subs))
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.opportunity
        assert "fell" in insight.title

    def test_silent_when_cost_negligible(self) -> None:
        # Sub-dollar cost per user is noise, not a signal.
        cpu = [3.0] * 6 + [4.0] * 29 + [6.0]
        subs = [50.0] * 36

        insight = CostPerUserDetector().evaluate(
            _context(_response_from(cost_per_user=cpu, active_subscriptions=subs))
        )

        assert insight is None


class TestCheckoutConversionDetector:
    def test_fires_when_conversion_drops(self) -> None:
        # 66 daily periods. Prior 30d: 20 checkouts, 16 succeeded (80%).
        # Recent 30d: 20 checkouts, 11 succeeded (55%) → down 25 points.
        checkouts = [0.0] * 6 + [20.0] + [0.0] * 29 + [20.0] + [0.0] * 29
        succeeded = [0.0] * 6 + [16.0] + [0.0] * 29 + [11.0] + [0.0] * 29

        insight = CheckoutConversionDetector().evaluate(
            _context(_response_from(checkouts=checkouts, succeeded_checkouts=succeeded))
        )

        assert insight is not None
        assert insight.category is InsightCategory.product
        assert insight.severity is InsightSeverity.warning
        assert "fell to 55%" in insight.title
        assert "down 25 points from 80%" in insight.body
        assert insight.detector_id == "checkout_conversion"

    def test_improvement_is_an_opportunity(self) -> None:
        checkouts = [0.0] * 6 + [20.0] + [0.0] * 29 + [20.0] + [0.0] * 29
        succeeded = [0.0] * 6 + [11.0] + [0.0] * 29 + [16.0] + [0.0] * 29

        insight = CheckoutConversionDetector().evaluate(
            _context(_response_from(checkouts=checkouts, succeeded_checkouts=succeeded))
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.opportunity
        assert "rose to 80%" in insight.title

    def test_no_insight_on_immaterial_change(self) -> None:
        # 80% → 78%, under the 5-point bar.
        checkouts = [0.0] * 6 + [20.0] + [0.0] * 29 + [50.0] + [0.0] * 29
        succeeded = [0.0] * 6 + [16.0] + [0.0] * 29 + [39.0] + [0.0] * 29

        insight = CheckoutConversionDetector().evaluate(
            _context(_response_from(checkouts=checkouts, succeeded_checkouts=succeeded))
        )

        assert insight is None

    def test_suppressed_when_recent_volume_too_small(self) -> None:
        # Only 3 recent checkouts — below the confidence floor.
        checkouts = [0.0] * 6 + [20.0] + [0.0] * 29 + [3.0] + [0.0] * 29
        succeeded = [0.0] * 6 + [16.0] + [0.0] * 29 + [0.0] + [0.0] * 29

        insight = CheckoutConversionDetector().evaluate(
            _context(_response_from(checkouts=checkouts, succeeded_checkouts=succeeded))
        )

        assert insight is None

    def test_no_insight_without_prior_baseline(self) -> None:
        # A recent funnel with no prior-window volume to compare against.
        checkouts = [0.0] * 36 + [20.0] + [0.0] * 29
        succeeded = [0.0] * 36 + [11.0] + [0.0] * 29

        insight = CheckoutConversionDetector().evaluate(
            _context(_response_from(checkouts=checkouts, succeeded_checkouts=succeeded))
        )

        assert insight is None

    def test_no_insight_with_partial_prior_window(self) -> None:
        # Only 45 days of history: the prior slice would be a partial 15-day
        # window, so comparing rates would be misleading — stay silent.
        checkouts = [0.0] * 5 + [20.0] + [0.0] * 24 + [20.0] + [0.0] * 14
        succeeded = [0.0] * 5 + [16.0] + [0.0] * 24 + [11.0] + [0.0] * 14
        assert len(checkouts) == 45

        insight = CheckoutConversionDetector().evaluate(
            _context(_response_from(checkouts=checkouts, succeeded_checkouts=succeeded))
        )

        assert insight is None
