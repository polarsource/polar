from polar.metrics.aggregation import latest, value_n_periods_ago

from ..schemas import Insight, InsightAction, InsightCategory, InsightSeverity
from ..signals import MetricSignal, format_currency, format_pct
from .base import Detector, DetectorContext, confidence_for_sample

# Fire only on a material month-over-month move, so the feed stays signal, not noise.
_MATERIAL_DELTA = 0.05
_LOOKBACK_DAYS = 30


class ARPUMovementDetector(Detector):
    """
    Month-over-month movement in average revenue per subscriber.

    ARPU rising means pricing power or upsell landing; falling means the base is
    diluting toward cheaper plans. Confidence is gated on the active subscription
    count so the average isn't dominated by one or two accounts.
    """

    id = "arpu_mom"
    category = InsightCategory.revenue
    category_label = "Revenue"
    priority = 40
    metric_slugs = ("average_revenue_per_user", "active_subscriptions")
    lookback_days = _LOOKBACK_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        response = ctx.metrics

        current = latest(response, "average_revenue_per_user")
        baseline = value_n_periods_ago(
            response, "average_revenue_per_user", _LOOKBACK_DAYS
        )
        if baseline is None or baseline == 0:
            return None

        sample_n = int(latest(response, "active_subscriptions"))
        confidence = confidence_for_sample(sample_n)
        if confidence is None:
            return None

        signal = MetricSignal(
            slug="average_revenue_per_user",
            current=current,
            baseline=baseline,
            sample_n=sample_n,
        )
        delta_pct = signal.delta_pct
        if delta_pct is None or abs(delta_pct) < _MATERIAL_DELTA:
            return None

        grew = delta_pct > 0
        pct_str = format_pct(delta_pct)
        title = (
            f"Revenue per subscriber grew {pct_str}"
            if grew
            else f"Revenue per subscriber fell {pct_str}"
        )
        direction = "up" if grew else "down"
        body = (
            f"Average revenue per subscriber is {format_currency(current)}, "
            f"{direction} {format_currency(abs(signal.delta_abs))} "
            f"from {format_currency(baseline)} 30 days ago "
            f"across {sample_n} active subscriptions."
        )
        why = (
            "Triggered by a month-over-month change in average revenue per "
            f"subscriber of at least 5%, across {sample_n} active subscriptions "
            f"({confidence.value} confidence)."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            # Rising ARPU is a lever worth leaning into; falling ARPU erodes unit
            # economics and needs attention.
            severity=InsightSeverity.opportunity if grew else InsightSeverity.warning,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=InsightAction(
                label="View ARPU trend",
                metric="average_revenue_per_user",
            ),
        )
