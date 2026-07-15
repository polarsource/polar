from polar.metrics.aggregation import latest, value_n_periods_ago

from ..schemas import Insight, InsightCategory, InsightSeverity, ViewMetricAction
from ..signals import format_pct
from .base import Detector, DetectorContext, confidence_for_sample

_WINDOW_DAYS = 30
# Only project within a horizon a merchant can act on; a two-year
# extrapolation is noise dressed as urgency.
_MAX_RUNWAY_DAYS = 180
_CRITICAL_RUNWAY_DAYS = 60


class MarginRunwayDetector(Detector):
    """
    Sustained margin decline projected to the date it reaches zero.

    Where the margin detector announces the level, this one narrates the
    trajectory: costs outgrowing revenue, straight-lined to the week gross
    margin hits zero. The projection is deliberately naive (linear, no
    seasonality, no interventions) and the copy frames it as a trajectory,
    never a forecast.
    """

    id = "margin_runway"
    category = InsightCategory.cost
    category_label = "Margin"
    priority = 14
    metric_slugs = ("gross_margin_percentage", "active_subscriptions")
    lookback_days = _WINDOW_DAYS + 5

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        current = latest(ctx.metrics, "gross_margin_percentage")
        baseline = value_n_periods_ago(
            ctx.metrics, "gross_margin_percentage", _WINDOW_DAYS
        )
        # 0 margin means no cost data, not a zero-margin business.
        if baseline is None or current <= 0 or baseline <= current:
            return None

        subs = int(latest(ctx.metrics, "active_subscriptions"))
        confidence = confidence_for_sample(subs)
        if confidence is None:
            return None

        daily_decline = (baseline - current) / _WINDOW_DAYS
        runway_days = current / daily_decline
        if runway_days > _MAX_RUNWAY_DAYS:
            return None
        runway_weeks = max(1, round(runway_days / 7))

        title = f"Margin trend reaches zero in about {runway_weeks} weeks"
        body = (
            f"Gross margin fell from {format_pct(baseline)} to "
            f"{format_pct(current)} over the last {_WINDOW_DAYS} days. If "
            f"that trajectory holds, costs consume all revenue in about "
            f"{runway_weeks} weeks."
        )
        why = (
            f"Triggered when gross margin declines over {_WINDOW_DAYS} days "
            f"and a straight-line extrapolation crosses zero within "
            f"{_MAX_RUNWAY_DAYS} days, weighted by {subs} active "
            f"subscriptions ({confidence.value} confidence). This is a "
            "trajectory, not a forecast. It assumes nothing changes."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=(
                InsightSeverity.critical
                if runway_days <= _CRITICAL_RUNWAY_DAYS
                else InsightSeverity.warning
            ),
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=ViewMetricAction(
                label="View margin", metric="gross_margin_percentage"
            ),
            suggested_prompt="What can I do to stop my margin from declining?",
        )
