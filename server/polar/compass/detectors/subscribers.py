from polar.metrics.aggregation import latest, value_n_periods_ago

from ..schemas import Insight, InsightAction, InsightCategory, InsightSeverity
from ..signals import MetricSignal, format_pct
from .base import Detector, DetectorContext, confidence_for_sample

# Fire only on a material month-over-month move, so the feed stays signal, not noise.
_MATERIAL_DELTA = 0.05
_LOOKBACK_DAYS = 30


class SubscriberGrowthDetector(Detector):
    """
    Month-over-month movement in the active subscription count.

    MRR can move on price alone; the subscriber count tells the merchant whether
    the *base* is growing. Confidence is gated on the current count so a jump from
    a handful of subscriptions doesn't read as a dramatic trend.
    """

    id = "subscribers_mom"
    category = InsightCategory.growth
    category_label = "Growth"
    priority = 30
    metric_slugs = ("active_subscriptions",)
    lookback_days = _LOOKBACK_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        response = ctx.metrics

        current = latest(response, "active_subscriptions")
        baseline = value_n_periods_ago(response, "active_subscriptions", _LOOKBACK_DAYS)
        if baseline is None:
            return None

        sample_n = int(current)
        confidence = confidence_for_sample(sample_n)
        if confidence is None:
            return None

        signal = MetricSignal(
            slug="active_subscriptions",
            current=current,
            baseline=baseline,
            sample_n=sample_n,
        )
        delta_pct = signal.delta_pct
        if delta_pct is None or abs(delta_pct) < _MATERIAL_DELTA:
            return None

        grew = delta_pct > 0
        pct_str = format_pct(delta_pct)
        current_n = int(current)
        baseline_n = int(baseline)
        delta_n = abs(current_n - baseline_n)
        title = (
            f"Subscriber base grew {pct_str} this month"
            if grew
            else f"Subscriber base shrank {pct_str} this month"
        )
        direction = "up" if grew else "down"
        body = (
            f"You have {current_n} active subscriptions, "
            f"{direction} {delta_n} from {baseline_n} 30 days ago."
        )
        why = (
            "Triggered by a month-over-month change in active subscriptions of at "
            f"least 5% across {sample_n} subscriptions ({confidence.value} confidence)."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=InsightSeverity.info if grew else InsightSeverity.warning,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=InsightAction(
                label="View subscriptions",
                metric="active_subscriptions",
            ),
        )
