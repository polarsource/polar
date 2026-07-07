import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from polar.compass.detectors import DETECTORS
from polar.compass.detectors.anomaly import CostAnomalyDetector
from polar.compass.detectors.arpu import ARPUMovementDetector
from polar.compass.detectors.base import DetectorContext, confidence_for_sample
from polar.compass.detectors.churn import ChurnSpikeDetector
from polar.compass.detectors.conversion import CheckoutConversionDetector
from polar.compass.detectors.cost_per_user import CostPerUserDetector
from polar.compass.detectors.currency import CurrencyOpportunityDetector
from polar.compass.detectors.customer_cost import CostConcentrationDetector
from polar.compass.detectors.involuntary_churn import InvoluntaryChurnDetector
from polar.compass.detectors.margin import GrossMarginDetector
from polar.compass.detectors.mrr import MRRGrowthDetector
from polar.compass.detectors.product_margin import ProductMarginDetector
from polar.compass.detectors.runway import MarginRunwayDetector
from polar.compass.detectors.subscribers import SubscriberGrowthDetector
from polar.compass.detectors.trials import TrialConversionDetector
from polar.compass.keys import build_insight_key, parse_insight_key
from polar.compass.schemas import (
    AddCurrencyAction,
    AdjustPriceAction,
    ConfidenceLevel,
    Insight,
    InsightCategory,
    InsightSeverity,
    ViewCostsAction,
    ViewMetricAction,
)
from polar.compass.signals import (
    CUSTOMER_COSTS_SAMPLE_LIMIT,
    ChurnBreakdown,
    CostAnomalySignal,
    CurrencyOpportunitySignal,
    CustomerCostSignal,
    ProductPricing,
)
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
        # A firing insight offers a one-tap follow-up, phrased for the direction.
        assert insight.suggested_prompt == "What's driving my MRR growth this month?"

    def test_decline_is_a_warning(self) -> None:
        # Mirror of the growth case: $1200 baseline down to $1000.
        mrr = [120_000.0] * 6 + [110_000.0] * 29 + [100_000.0]
        subs = [50.0] * 36

        insight = MRRGrowthDetector().evaluate(_context(_response(mrr, subs)))

        assert insight is not None
        assert insight.severity is InsightSeverity.warning
        assert "fell 17%" in insight.title
        assert insight.suggested_prompt == "Why did my MRR fall this month?"

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

    def test_confidence_scales_with_cost_bearing_customers(self) -> None:
        # 60 customers with costs: past the medium threshold (20), so the
        # insight must not be capped at low confidence by a truncated fetch.
        signals = [_cost_signal("whale@corp.com", 0.45)] + [
            _cost_signal(f"c{i}@x.com", 0.009) for i in range(59)
        ]

        insight = CostConcentrationDetector().evaluate(
            _context_with_customer_costs(signals)
        )

        assert insight is not None
        assert insight.confidence is ConfidenceLevel.medium
        assert "across 60 customers" in insight.body

    def test_copy_says_at_least_when_sample_is_capped(self) -> None:
        signals = [_cost_signal("whale@corp.com", 0.45)] + [
            _cost_signal(f"c{i}@x.com", 0.005)
            for i in range(CUSTOMER_COSTS_SAMPLE_LIMIT - 1)
        ]

        insight = CostConcentrationDetector().evaluate(
            _context_with_customer_costs(signals)
        )

        assert insight is not None
        assert insight.confidence is ConfidenceLevel.high
        assert f"at least {CUSTOMER_COSTS_SAMPLE_LIMIT} customers" in insight.body

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

    def test_silent_when_baseline_negligible(self) -> None:
        # Cost tracking just started: a near-zero baseline against real costs
        # would read as an absurd million-percent increase, not a trend.
        cpu = [1.0] * 6 + [1.0] * 29 + [13_750.0]
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


def _product(
    name: str = "Pro",
    price_amount: int = 4000,
    margin: float = 0.5,
    subs: float = 50.0,
    currency: str = "usd",
) -> ProductPricing:
    return ProductPricing(
        product_id=uuid.uuid4(),
        name=name,
        price_amount=price_amount,
        currency=currency,
        metrics=_response_from(
            gross_margin_percentage=[margin] * 36,
            active_subscriptions=[subs] * 36,
        ),
    )


def _context_with_customer_costs(
    customer_costs: list[CustomerCostSignal],
) -> DetectorContext:
    return DetectorContext(
        organization_id=uuid.uuid4(),
        timezone=ZoneInfo("UTC"),
        today=date(2026, 2, 6),
        metrics=_response_from(active_subscriptions=[50.0] * 36),
        customer_costs=tuple(customer_costs),
    )


def _cost_signal(label: str, share: float, amount: float = 100.0) -> CustomerCostSignal:
    return CustomerCostSignal(label=label, amount=amount, share=share)


def _context_with_products(products: list[ProductPricing]) -> DetectorContext:
    return DetectorContext(
        organization_id=uuid.uuid4(),
        timezone=ZoneInfo("UTC"),
        today=date(2026, 2, 6),
        metrics=_response_from(gross_margin_percentage=[0.5] * 36),
        products=tuple(products),
    )


class TestProductMarginDetector:
    def test_fires_with_price_suggestion(self) -> None:
        # $40 product at 41% margin: ~$23.60 goes to serving each customer.
        product = _product(price_amount=4000, margin=0.41)

        insight = ProductMarginDetector().evaluate(_context_with_products([product]))

        assert insight is not None
        assert insight.category is InsightCategory.cost
        assert insight.severity is InsightSeverity.warning
        assert "Pro margin is down to 41%" in insight.title
        assert "$23.60 per customer" in insight.body
        action = insight.primary_action
        assert isinstance(action, AdjustPriceAction)
        assert action.product_id == product.product_id
        assert action.current_price_amount == 4000
        # ceil(4000 * 0.59 / 0.30 / 100) * 100 — the price restoring 70% margin.
        assert action.suggested_price_amount == 7900
        assert "$79" in insight.body

    def test_deep_margin_loss_is_critical(self) -> None:
        insight = ProductMarginDetector().evaluate(
            _context_with_products([_product(margin=0.30)])
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.critical

    def test_picks_the_worst_product(self) -> None:
        healthy = _product(name="Starter", margin=0.85)
        thin = _product(name="Pro", margin=0.55)
        thinner = _product(name="Enterprise", margin=0.45)

        insight = ProductMarginDetector().evaluate(
            _context_with_products([healthy, thin, thinner])
        )

        assert insight is not None
        assert "Enterprise" in insight.title
        action = insight.primary_action
        assert isinstance(action, AdjustPriceAction)
        assert action.product_id == thinner.product_id

    def test_no_insight_when_margins_healthy(self) -> None:
        insight = ProductMarginDetector().evaluate(
            _context_with_products([_product(margin=0.85)])
        )

        assert insight is None

    def test_silent_without_cost_data(self) -> None:
        # Margin of 0 means no cost data for the product, not a 0% business.
        insight = ProductMarginDetector().evaluate(
            _context_with_products([_product(margin=0.0)])
        )

        assert insight is None

    def test_suppressed_when_sample_too_small(self) -> None:
        insight = ProductMarginDetector().evaluate(
            _context_with_products([_product(margin=0.41, subs=3.0)])
        )

        assert insight is None

    def test_no_insight_without_products(self) -> None:
        insight = ProductMarginDetector().evaluate(_context_with_products([]))

        assert insight is None


class TestCostConcentrationDetector:
    def test_fires_on_concentration(self) -> None:
        signals = [_cost_signal("big@corp.com", 0.55)] + [
            _cost_signal(f"c{i}@x.com", 0.09) for i in range(5)
        ]

        insight = CostConcentrationDetector().evaluate(
            _context_with_customer_costs(signals)
        )

        assert insight is not None
        assert insight.category is InsightCategory.risk
        assert insight.severity is InsightSeverity.warning
        assert "55% of your costs" in insight.title
        assert "big@corp.com" in insight.body
        assert insight.detector_id == "cost_concentration"

    def test_extreme_concentration_is_critical(self) -> None:
        signals = [_cost_signal("whale@corp.com", 0.7)] + [
            _cost_signal(f"c{i}@x.com", 0.06) for i in range(5)
        ]

        insight = CostConcentrationDetector().evaluate(
            _context_with_customer_costs(signals)
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.critical

    def test_silent_when_costs_spread_out(self) -> None:
        signals = [_cost_signal(f"c{i}@x.com", 0.2) for i in range(5)]

        insight = CostConcentrationDetector().evaluate(
            _context_with_customer_costs(signals)
        )

        assert insight is None

    def test_suppressed_when_too_few_customers(self) -> None:
        signals = [_cost_signal("a@x.com", 0.8), _cost_signal("b@x.com", 0.2)]

        insight = CostConcentrationDetector().evaluate(
            _context_with_customer_costs(signals)
        )

        assert insight is None

    def test_silent_without_cost_data(self) -> None:
        insight = CostConcentrationDetector().evaluate(_context_with_customer_costs([]))

        assert insight is None


class TestSuggestedPriceRounding:
    def test_cent_currency_rounds_to_next_dollar(self) -> None:
        product = _product(price_amount=5000, margin=0.45, currency="usd")

        insight = ProductMarginDetector().evaluate(_context_with_products([product]))

        assert insight is not None
        assert isinstance(insight.primary_action, AdjustPriceAction)
        # target = 5000 * 0.55 / 0.30 = 9166.67 -> next dollar
        assert insight.primary_action.suggested_price_amount == 9200

    def test_zero_decimal_currency_rounds_to_next_unit(self) -> None:
        product = _product(price_amount=5000, margin=0.45, currency="jpy")

        insight = ProductMarginDetector().evaluate(_context_with_products([product]))

        assert insight is not None
        assert isinstance(insight.primary_action, AdjustPriceAction)
        # same target, but JPY's smallest unit IS the display unit -> next yen
        assert insight.primary_action.suggested_price_amount == 9167
        # copy formats in the product's currency, not hardcoded USD cents
        assert "¥5,000" in insight.body
        assert "$50" not in insight.body


def _runway_response(start: float, end: float) -> MetricsResponse:
    # 36 daily points interpolating margin from start to end.
    step = (end - start) / 35
    return _response_from(
        gross_margin_percentage=[start + step * i for i in range(36)],
        active_subscriptions=[60.0] * 36,
    )


def _context_with_churn(voluntary: int, involuntary: int) -> DetectorContext:
    return DetectorContext(
        organization_id=uuid.uuid4(),
        timezone=ZoneInfo("UTC"),
        today=date(2026, 2, 6),
        metrics=_response_from(active_subscriptions=[50.0] * 36),
        churn_breakdown=ChurnBreakdown(voluntary=voluntary, involuntary=involuntary),
    )


def _context_with_currencies(
    *signals: CurrencyOpportunitySignal,
) -> DetectorContext:
    return DetectorContext(
        organization_id=uuid.uuid4(),
        timezone=ZoneInfo("UTC"),
        today=date(2026, 2, 6),
        metrics=_response_from(active_subscriptions=[50.0] * 36),
        currency_signals=signals,
    )


def _currency_signal(
    currency: str = "eur", share: float = 0.31, orders: int = 24
) -> CurrencyOpportunitySignal:
    return CurrencyOpportunitySignal(
        currency=currency,
        revenue_share=share,
        order_count=orders,
        countries=("DE", "FR", "NL"),
    )


def _context_with_cost_anomalies(
    *signals: CostAnomalySignal,
) -> DetectorContext:
    return DetectorContext(
        organization_id=uuid.uuid4(),
        timezone=ZoneInfo("UTC"),
        today=date(2026, 2, 6),
        metrics=_response_from(active_subscriptions=[50.0] * 36),
        cost_anomalies=signals,
    )


def _cost_anomaly(
    event_name: str = "openai.completion",
    count: int = 3,
    total: float = 4_800.0,
    max_amount: float = 3_200.0,
    average: float = 800.0,
    p99: float = 2_400.0,
    max_event_id: uuid.UUID | None = None,
) -> CostAnomalySignal:
    return CostAnomalySignal(
        event_name=event_name,
        anomaly_count=count,
        total_amount=total,
        max_amount=max_amount,
        max_event_id=max_event_id or uuid.uuid4(),
        average_amount=average,
        p99_amount=p99,
    )


class TestMarginRunwayDetector:
    def test_fires_on_projected_zero_within_horizon(self) -> None:
        # The 30-day baseline reads ~0.529 on the interpolated series, so the
        # trajectory reaches zero in ~93 days, about 13 weeks.
        insight = MarginRunwayDetector().evaluate(
            _context(_runway_response(0.55, 0.40))
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.warning
        assert "reaches zero in about 13 weeks" in insight.title
        assert insight.why is not None
        assert "trajectory" in insight.why

    def test_short_runway_is_critical(self) -> None:
        # 0.50 -> 0.20 over 30 days: runway = 0.20 / 0.01 = 20 days.
        insight = MarginRunwayDetector().evaluate(
            _context(_runway_response(0.50, 0.20))
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.critical

    def test_silent_when_projection_beyond_horizon(self) -> None:
        # 0.71 -> 0.70 over 30 days: runway far beyond 180 days.
        insight = MarginRunwayDetector().evaluate(
            _context(_runway_response(0.71, 0.70))
        )

        assert insight is None

    def test_silent_when_margin_improving(self) -> None:
        insight = MarginRunwayDetector().evaluate(
            _context(_runway_response(0.40, 0.55))
        )

        assert insight is None

    def test_silent_without_cost_data(self) -> None:
        insight = MarginRunwayDetector().evaluate(_context(_runway_response(0.0, 0.0)))

        assert insight is None


class TestInvoluntaryChurnDetector:
    def test_fires_on_meaningful_failed_payment_share(self) -> None:
        insight = InvoluntaryChurnDetector().evaluate(_context_with_churn(5, 4))

        assert insight is not None
        assert insight.category is InsightCategory.retention
        assert insight.severity is InsightSeverity.warning
        assert "Failed payments drove 4 of 9" in insight.title

    def test_dominant_share_is_critical(self) -> None:
        insight = InvoluntaryChurnDetector().evaluate(_context_with_churn(2, 6))

        assert insight is not None
        assert insight.severity is InsightSeverity.critical

    def test_silent_when_share_is_noise(self) -> None:
        insight = InvoluntaryChurnDetector().evaluate(_context_with_churn(9, 1))

        assert insight is None

    def test_suppressed_below_sample_gate(self) -> None:
        insight = InvoluntaryChurnDetector().evaluate(_context_with_churn(2, 2))

        assert insight is None

    def test_silent_without_breakdown(self) -> None:
        insight = InvoluntaryChurnDetector().evaluate(
            _context(_response_from(active_subscriptions=[50.0] * 36))
        )

        assert insight is None


class TestCurrencyOpportunityDetector:
    def test_fires_on_meaningful_unpriced_currency(self) -> None:
        insight = CurrencyOpportunityDetector().evaluate(
            _context_with_currencies(_currency_signal())
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.opportunity
        assert "31% of revenue comes from EUR countries" in insight.title
        assert "DE, FR, NL" in insight.body
        action = insight.primary_action
        assert isinstance(action, AddCurrencyAction)
        assert action.currency == "eur"
        assert action.label == "Add EUR pricing"

    def test_silent_below_revenue_share(self) -> None:
        insight = CurrencyOpportunityDetector().evaluate(
            _context_with_currencies(_currency_signal(share=0.08))
        )

        assert insight is None

    def test_suppressed_below_order_sample(self) -> None:
        insight = CurrencyOpportunityDetector().evaluate(
            _context_with_currencies(_currency_signal(orders=3))
        )

        assert insight is None

    def test_silent_without_signals(self) -> None:
        insight = CurrencyOpportunityDetector().evaluate(
            _context(_response_from(active_subscriptions=[50.0] * 36))
        )

        assert insight is None


class TestCostAnomalyDetector:
    def test_fires_on_spike_well_past_typical(self) -> None:
        event_id = uuid.uuid4()
        insight = CostAnomalyDetector().evaluate(
            _context_with_cost_anomalies(_cost_anomaly(max_event_id=event_id))
        )

        assert insight is not None
        assert insight.category is InsightCategory.cost
        assert insight.severity is InsightSeverity.warning
        assert "Cost spike in openai.completion" in insight.title
        assert "4x the typical" in insight.body
        action = insight.primary_action
        assert isinstance(action, ViewCostsAction)
        assert action.label == "View cost event"
        assert action.event_id == event_id

    def test_extreme_spike_is_critical(self) -> None:
        insight = CostAnomalyDetector().evaluate(
            _context_with_cost_anomalies(
                _cost_anomaly(max_amount=6_400.0, average=800.0)
            )
        )

        assert insight is not None
        assert insight.severity is InsightSeverity.critical

    def test_single_outlier_is_low_confidence(self) -> None:
        insight = CostAnomalyDetector().evaluate(
            _context_with_cost_anomalies(_cost_anomaly(count=1))
        )

        assert insight is not None
        assert insight.confidence is ConfidenceLevel.low
        assert "1 openai.completion event " in insight.body

    def test_silent_when_spike_is_within_normal_spread(self) -> None:
        # Largest trace only ~1.5x the average: a p99 outlier, but not news.
        insight = CostAnomalyDetector().evaluate(
            _context_with_cost_anomalies(
                _cost_anomaly(max_amount=1_200.0, average=800.0)
            )
        )

        assert insight is None

    def test_silent_when_total_is_negligible(self) -> None:
        insight = CostAnomalyDetector().evaluate(
            _context_with_cost_anomalies(
                _cost_anomaly(total=30.0, max_amount=20.0, average=4.0)
            )
        )

        assert insight is None

    def test_skips_to_the_first_genuine_spike(self) -> None:
        # The service sorts by total desc, but the top signal may be a p99
        # outlier within normal spread; the detector skips it for the first
        # that actually spiked.
        insight = CostAnomalyDetector().evaluate(
            _context_with_cost_anomalies(
                _cost_anomaly(
                    event_name="within.spread", max_amount=1_200.0, average=800.0
                ),
                _cost_anomaly(event_name="real.spike"),
            )
        )

        assert insight is not None
        assert "real.spike" in insight.title

    def test_silent_without_anomalies(self) -> None:
        insight = CostAnomalyDetector().evaluate(
            _context(_response_from(active_subscriptions=[50.0] * 36))
        )

        assert insight is None


class TestInsightCopy:
    def test_no_em_dashes_in_any_emitted_copy(self) -> None:
        """Em dashes are banned in user-facing copy; use comma, colon or period."""
        subs = [50.0] * 36
        firing: list[Insight | None] = [
            MRRGrowthDetector().evaluate(
                _context(
                    _response([100_000.0] * 6 + [110_000.0] * 29 + [120_000.0], subs)
                )
            ),
            SubscriberGrowthDetector().evaluate(
                _context(
                    _response_from(
                        active_subscriptions=[10.0] * 6 + [12.0] * 29 + [16.0]
                    )
                )
            ),
            ARPUMovementDetector().evaluate(
                _context(
                    _response_from(
                        average_revenue_per_user=[25_000.0] * 6
                        + [22_000.0] * 29
                        + [19_400.0],
                        active_subscriptions=subs,
                    )
                )
            ),
            # Churn with a rising prior window, so the extra sentence renders too.
            ChurnSpikeDetector().evaluate(
                _context(
                    _response_from(
                        churned_subscriptions=[0.0] * 6 + [1.0] * 30 + [2.0] * 30,
                        active_subscriptions=[50.0] * 66,
                    )
                )
            ),
            TrialConversionDetector().evaluate(
                _context(
                    _response_from(
                        trial_monthly_recurring_revenue=[0.0] * 35 + [100_000.0],
                        monthly_recurring_revenue=[900_000.0] * 36,
                        active_subscriptions=subs,
                    )
                )
            ),
            GrossMarginDetector().evaluate(
                _context(
                    _response_from(
                        gross_margin_percentage=[0.8] * 6 + [0.75] * 29 + [0.55],
                        active_subscriptions=subs,
                    )
                )
            ),
            CostPerUserDetector().evaluate(
                _context(
                    _response_from(
                        cost_per_user=[200.0] * 6 + [250.0] * 29 + [300.0],
                        active_subscriptions=subs,
                    )
                )
            ),
            CheckoutConversionDetector().evaluate(
                _context(
                    _response_from(
                        checkouts=[0.0] * 6 + [20.0] + [0.0] * 29 + [20.0] + [0.0] * 29,
                        succeeded_checkouts=[0.0] * 6
                        + [16.0]
                        + [0.0] * 29
                        + [11.0]
                        + [0.0] * 29,
                    )
                )
            ),
            ProductMarginDetector().evaluate(
                _context_with_products([_product(margin=0.41)])
            ),
            MarginRunwayDetector().evaluate(_context(_runway_response(0.50, 0.20))),
            InvoluntaryChurnDetector().evaluate(_context_with_churn(5, 4)),
            CurrencyOpportunityDetector().evaluate(
                _context_with_currencies(_currency_signal())
            ),
            CostConcentrationDetector().evaluate(
                _context_with_customer_costs(
                    [_cost_signal("big@corp.com", 0.62)]
                    + [_cost_signal(f"c{i}@x.com", 0.076) for i in range(5)]
                )
            ),
            CostAnomalyDetector().evaluate(
                _context_with_cost_anomalies(_cost_anomaly())
            ),
        ]

        assert len(firing) == len(DETECTORS)
        for insight in firing:
            assert insight is not None, "every registered detector must fire here"
            copy = [insight.title, insight.body, insight.why or ""]
            if insight.primary_action is not None:
                copy.append(insight.primary_action.label)
            for text in copy:
                assert "—" not in text, f"em dash in {insight.detector_id}: {text!r}"


class TestInsightActionUnion:
    def test_adjust_price_round_trips_through_the_wire_format(self) -> None:
        insight = ProductMarginDetector().evaluate(
            _context_with_products([_product(margin=0.41)])
        )
        assert insight is not None

        parsed = Insight.model_validate(insight.model_dump())

        assert isinstance(parsed.primary_action, AdjustPriceAction)
        assert parsed.primary_action.type == "adjust_price"

    def test_view_metric_round_trips_through_the_wire_format(self) -> None:
        mrr = [100_000.0] * 6 + [110_000.0] * 29 + [120_000.0]
        insight = MRRGrowthDetector().evaluate(_context(_response(mrr, [50.0] * 36)))
        assert insight is not None

        parsed = Insight.model_validate(insight.model_dump())

        assert isinstance(parsed.primary_action, ViewMetricAction)
        assert parsed.primary_action.type == "view_metric"

    def test_view_costs_round_trips_through_the_wire_format(self) -> None:
        insight = CostAnomalyDetector().evaluate(
            _context_with_cost_anomalies(_cost_anomaly())
        )
        assert insight is not None

        parsed = Insight.model_validate(insight.model_dump())

        assert isinstance(parsed.primary_action, ViewCostsAction)
        assert parsed.primary_action.type == "view_costs"
