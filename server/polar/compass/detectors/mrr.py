from ..schemas import Insight, InsightAction, InsightCategory, InsightSeverity
from ..signals import MetricSignal, latest, value_n_periods_ago
from .base import Detector, DetectorContext, confidence_for_sample

# Fire only on a material month-over-month move, so the feed stays signal, not noise.
_MATERIAL_DELTA = 0.05
_LOOKBACK_DAYS = 30


def _format_currency(cents: float) -> str:
    return f"${cents / 100:,.0f}"


class MRRGrowthDetector(Detector):
    """
    Month-over-month movement in Monthly Recurring Revenue.

    The headline number is deterministic; confidence is gated on the active
    subscription count so a tiny base doesn't produce dramatic-looking swings.
    Driver decomposition (new vs expansion vs churn) is the natural next step and
    belongs in a dedicated Tinybird breakdown pipe — left empty here.
    """

    id = "mrr_mom"
    category = InsightCategory.revenue
    category_label = "Revenue"
    priority = 20
    metric_slugs = ("monthly_recurring_revenue", "active_subscriptions")
    lookback_days = _LOOKBACK_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        response = ctx.metrics

        current = latest(response, "monthly_recurring_revenue")
        baseline = value_n_periods_ago(
            response, "monthly_recurring_revenue", _LOOKBACK_DAYS
        )
        if baseline is None:
            return None

        sample_n = int(latest(response, "active_subscriptions"))
        confidence = confidence_for_sample(sample_n)
        if confidence is None:
            return None

        signal = MetricSignal(
            slug="monthly_recurring_revenue",
            current=current,
            baseline=baseline,
            sample_n=sample_n,
        )
        delta_pct = signal.delta_pct
        if delta_pct is None or abs(delta_pct) < _MATERIAL_DELTA:
            return None

        grew = delta_pct > 0
        pct_str = f"{abs(delta_pct) * 100:.0f}%"
        title = (
            f"MRR grew {pct_str} this month"
            if grew
            else f"MRR fell {pct_str} this month"
        )
        direction = "up" if grew else "down"
        body = (
            f"Monthly recurring revenue is {_format_currency(current)}, "
            f"{direction} {_format_currency(abs(signal.delta_abs))} "
            f"from {_format_currency(baseline)} 30 days ago "
            f"across {sample_n} active subscriptions."
        )
        why = (
            "Triggered by a month-over-month change in MRR of at least 5%, "
            f"weighted by {sample_n} active subscriptions ({confidence.value} confidence)."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            # Severity follows the direction of the move: shrinking revenue
            # needs attention, growing revenue is good news.
            severity=InsightSeverity.info if grew else InsightSeverity.warning,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=InsightAction(
                label="View MRR trend",
                href="analytics/metrics?metric=monthly_recurring_revenue",
            ),
        )
