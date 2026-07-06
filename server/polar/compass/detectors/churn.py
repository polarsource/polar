from ..schemas import Insight, InsightAction, InsightCategory, InsightSeverity
from ..signals import format_pct, latest, series
from .base import Detector, DetectorContext, confidence_for_sample

_WINDOW_DAYS = 30
# A rolling 30-day cancellation rate below this is background noise, not a signal.
_MATERIAL_RATE = 0.03
# Above this, cancellations are severe enough to lead the feed.
_CRITICAL_RATE = 0.10


class ChurnSpikeDetector(Detector):
    """
    Elevated subscription churn over the trailing 30 days.

    Reads the daily `churned_subscriptions` series and rolls it into a 30-day
    cancellation rate against the population that was at risk (still-active plus
    those that left). Confidence is gated on that population so a single
    cancellation off a tiny base doesn't read as a spike. A dedicated Tinybird
    cancellations pipe is the natural home for the rolling window — see the
    `ChurnRateMetric` TODO in `metrics`.
    """

    id = "churn_spike"
    category = InsightCategory.retention
    category_label = "Retention"
    priority = 10
    metric_slugs = ("churned_subscriptions", "active_subscriptions")
    lookback_days = 2 * _WINDOW_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        response = ctx.metrics

        churned = series(response, "churned_subscriptions")
        if len(churned) <= _WINDOW_DAYS:
            return None

        recent = sum(churned[-_WINDOW_DAYS:])
        if recent < 1:
            return None

        active = latest(response, "active_subscriptions")
        at_risk = int(active + recent)
        confidence = confidence_for_sample(at_risk)
        if confidence is None:
            return None

        churn_rate = recent / at_risk if at_risk else 0.0
        if churn_rate < _MATERIAL_RATE:
            return None

        churned_n = int(recent)
        active_n = int(active)
        rate_str = format_pct(churn_rate)
        critical = churn_rate >= _CRITICAL_RATE

        subscriptions = "subscription" if churned_n == 1 else "subscriptions"
        title = f"{churned_n} {subscriptions} churned this month"
        body = (
            f"{churned_n} {subscriptions} ended in the last 30 days, "
            f"{rate_str} of an at-risk base of {at_risk} — you have {active_n} "
            f"active subscriptions today."
        )

        prior = sum(churned[-2 * _WINDOW_DAYS : -_WINDOW_DAYS])
        if prior and recent > prior:
            body += f" That's up from {int(prior)} the prior 30 days."

        why = (
            "Triggered by a trailing-30-day cancellation rate of at least 3% "
            f"across an at-risk base of {at_risk} ({confidence.value} confidence)."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=InsightSeverity.critical if critical else InsightSeverity.warning,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=InsightAction(
                label="View churn",
                metric="churned_subscriptions",
            ),
        )
