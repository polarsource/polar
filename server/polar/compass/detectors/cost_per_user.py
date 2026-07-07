from polar.metrics.aggregation import latest, value_n_periods_ago

from ..schemas import Insight, InsightAction, InsightCategory, InsightSeverity
from ..signals import MetricSignal, format_currency, format_pct
from .base import Detector, DetectorContext, confidence_for_sample

# Fire only on a material month-over-month move, so the feed stays signal, not noise.
_MATERIAL_DELTA = 0.05
# Ignore sub-dollar unit costs so cent-level noise doesn't produce alarming percentages.
_MIN_COST_PER_USER = 100
_LOOKBACK_DAYS = 30


class CostPerUserDetector(Detector):
    """
    Month-over-month movement in cost to serve each subscriber.

    Rising cost per user is the early warning that unit economics are drifting
    before it shows up in margin. Reads the cost-adjusted `cost_per_user`; stays
    silent when there's no meaningful cost data (sub-dollar) so cent-level noise
    doesn't fire a card.
    """

    id = "cost_per_user"
    category = InsightCategory.cost
    category_label = "Costs"
    priority = 45
    metric_slugs = ("cost_per_user", "active_subscriptions")
    lookback_days = _LOOKBACK_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        response = ctx.metrics

        current = latest(response, "cost_per_user")
        if current < _MIN_COST_PER_USER:
            return None

        baseline = value_n_periods_ago(response, "cost_per_user", _LOOKBACK_DAYS)
        if baseline is None or baseline == 0:
            return None

        sample_n = int(latest(response, "active_subscriptions"))
        confidence = confidence_for_sample(sample_n)
        if confidence is None:
            return None

        signal = MetricSignal(
            slug="cost_per_user",
            current=current,
            baseline=baseline,
            sample_n=sample_n,
        )
        delta_pct = signal.delta_pct
        if delta_pct is None or abs(delta_pct) < _MATERIAL_DELTA:
            return None

        rose = delta_pct > 0
        pct_str = format_pct(delta_pct)
        title = (
            f"Cost per subscriber rose {pct_str}"
            if rose
            else f"Cost per subscriber fell {pct_str}"
        )
        direction = "up" if rose else "down"
        body = (
            f"It costs {format_currency(current)} to serve each subscriber, "
            f"{direction} {format_currency(abs(signal.delta_abs))} "
            f"from {format_currency(baseline)} 30 days ago "
            f"across {sample_n} active subscriptions."
        )
        why = (
            "Triggered by a month-over-month change in cost per subscriber of at "
            f"least 5%, across {sample_n} active subscriptions "
            f"({confidence.value} confidence)."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            # Rising cost erodes unit economics; falling cost is a win to build on.
            severity=InsightSeverity.warning if rose else InsightSeverity.opportunity,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=InsightAction(
                label="View cost per user",
                metric="cost_per_user",
            ),
        )
