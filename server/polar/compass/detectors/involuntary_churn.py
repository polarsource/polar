from ..schemas import Insight, InsightCategory, InsightSeverity, ViewMetricAction
from ..signals import format_pct
from .base import Detector, DetectorContext, confidence_for_sample

_WINDOW_DAYS = 30
# Below this share, payment failures are background noise; above the critical
# bar they are the churn story.
_SHARE_WARNING = 0.30
_SHARE_CRITICAL = 0.60
_MIN_INVOLUNTARY = 2


class InvoluntaryChurnDetector(Detector):
    """
    Churn that is payment failure, not customer choice.

    Merchants read their churn number as customers leaving, but a slice of it
    is failed payments and exhausted dunning. That slice is the most
    recoverable revenue there is, so it gets its own card next to the churn
    reading. Fed by the service's churn breakdown prefetch, keeping the
    detector pure.
    """

    id = "involuntary_churn"
    category = InsightCategory.retention
    category_label = "Retention"
    priority = 18
    metric_slugs = ()
    needs_churn_breakdown = True
    lookback_days = _WINDOW_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        breakdown = ctx.churn_breakdown
        if breakdown is None or breakdown.total == 0:
            return None

        confidence = confidence_for_sample(breakdown.total)
        if confidence is None:
            return None

        share = breakdown.involuntary / breakdown.total
        if breakdown.involuntary < _MIN_INVOLUNTARY or share < _SHARE_WARNING:
            return None

        title = (
            f"Failed payments drove {breakdown.involuntary} of "
            f"{breakdown.total} churned subscriptions"
        )
        body = (
            f"{breakdown.involuntary} of the {breakdown.total} subscriptions "
            f"that ended in the last {_WINDOW_DAYS} days were payment "
            "failures, not cancellations. Recovering failed payments is "
            "cheaper than winning new customers. Review your dunning "
            "settings."
        )
        why = (
            f"Triggered when payment failures exceed "
            f"{format_pct(_SHARE_WARNING)} of ended subscriptions, over "
            f"{breakdown.total} ended subscriptions ({confidence.value} "
            "confidence). A subscription counts as involuntary when it ended "
            "while past due on payment."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=(
                InsightSeverity.critical
                if share >= _SHARE_CRITICAL
                else InsightSeverity.warning
            ),
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=ViewMetricAction(
                label="View churn", metric="churned_subscriptions"
            ),
        )
