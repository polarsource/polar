from polar.metrics.aggregation import latest, value_n_periods_ago

from ..schemas import Insight, InsightAction, InsightCategory, InsightSeverity
from ..signals import format_pct
from .base import Detector, DetectorContext, confidence_for_sample

# Below this a margin is thin enough to flag; below the critical bar it leads the feed.
_HEALTHY_MARGIN = 0.70
_CRITICAL_MARGIN = 0.40
# A month-over-month swing of at least 5 percentage points is a real move.
_MATERIAL_MOVE = 0.05
_LOOKBACK_DAYS = 30


class GrossMarginDetector(Detector):
    """
    Gross margin health and month-over-month movement.

    For AI startups, model and infrastructure cost is what turns revenue into
    margin, so margin is the number the feature leads with. Reads the
    cost-adjusted `gross_margin_percentage`; when there's no cost/revenue data
    (margin resolves to 0) the detector stays silent rather than reporting a
    misleading 0%.
    """

    id = "gross_margin"
    category = InsightCategory.cost
    category_label = "Margin"
    priority = 15
    metric_slugs = ("gross_margin_percentage", "active_subscriptions")
    lookback_days = _LOOKBACK_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        response = ctx.metrics

        current = latest(response, "gross_margin_percentage")
        if current <= 0:
            return None

        sample_n = int(latest(response, "active_subscriptions"))
        confidence = confidence_for_sample(sample_n)
        if confidence is None:
            return None

        baseline = value_n_periods_ago(
            response, "gross_margin_percentage", _LOOKBACK_DAYS
        )
        move = None if baseline is None or baseline == 0 else current - baseline
        thin = current < _HEALTHY_MARGIN
        dropped = move is not None and move <= -_MATERIAL_MOVE
        improved = move is not None and move >= _MATERIAL_MOVE

        if not (thin or dropped or improved):
            return None

        margin_str = format_pct(current)
        kept = f"${current * 100:,.0f}"
        if dropped:
            title = f"Gross margin compressed to {margin_str}"
        elif improved:
            title = f"Gross margin improved to {margin_str}"
        else:
            title = f"Gross margin is {margin_str}"
        body = (
            f"You keep {kept} of every $100 in revenue after costs. "
            f"Gross margin is {margin_str}"
        )
        if move is not None and baseline is not None:
            direction = "down" if move < 0 else "up"
            body += (
                f", {direction} {format_pct(move)} from {format_pct(baseline)} "
                "30 days ago."
            )
        else:
            body += " over the last 30 days."

        if current < _CRITICAL_MARGIN:
            severity = InsightSeverity.critical
        elif thin or dropped:
            severity = InsightSeverity.warning
        else:
            severity = InsightSeverity.opportunity

        why = (
            "Triggered when gross margin is below 70% or moves at least 5 points "
            f"month-over-month, across {sample_n} active subscriptions "
            f"({confidence.value} confidence)."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=severity,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=InsightAction(
                label="View margin",
                metric="gross_margin_percentage",
            ),
        )
