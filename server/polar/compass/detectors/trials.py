from polar.metrics.aggregation import latest

from ..schemas import Insight, InsightCategory, InsightSeverity, ViewMetricAction
from ..signals import format_currency, format_pct
from .base import Detector, DetectorContext, confidence_for_sample

# Below this share of run-rate, the trial pipeline is too small to be worth a card.
_MATERIAL_SHARE = 0.05
_LOOKBACK_DAYS = 30


class TrialConversionDetector(Detector):
    """
    Trialing revenue in the pipeline, up for conversion.

    Trials on active plans carry MRR that hasn't converted yet; surfacing it as a
    share of run-rate turns "some trials are out there" into a concrete revenue
    opportunity to chase before they lapse. Per-subscription conversion
    attribution (which trials became paid) needs a dedicated breakdown pipe and is
    left to a follow-up — this reads the aggregate trialing MRR the metrics service
    already computes.
    """

    id = "trial_conversion"
    category = InsightCategory.growth
    category_label = "Growth"
    priority = 50
    metric_slugs = (
        "trial_monthly_recurring_revenue",
        "monthly_recurring_revenue",
        "active_subscriptions",
    )
    lookback_days = _LOOKBACK_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        response = ctx.metrics

        trial_mrr = latest(response, "trial_monthly_recurring_revenue")
        if trial_mrr <= 0:
            return None

        sample_n = int(latest(response, "active_subscriptions"))
        confidence = confidence_for_sample(sample_n)
        if confidence is None:
            return None

        active_mrr = latest(response, "monthly_recurring_revenue")
        total = active_mrr + trial_mrr
        share = trial_mrr / total if total else 0.0
        if share < _MATERIAL_SHARE:
            return None

        share_str = format_pct(share)
        title = f"{format_currency(trial_mrr)} of trialing MRR could convert"
        body = (
            f"Trials on active plans represent {format_currency(trial_mrr)} in "
            f"monthly recurring revenue, {share_str} of your run rate, up for "
            "conversion as their trials end."
        )
        why = (
            "Triggered when trialing MRR is at least 5% of total run rate, across "
            f"{sample_n} active subscriptions ({confidence.value} confidence)."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=InsightSeverity.opportunity,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=ViewMetricAction(
                label="View trials",
                metric="trial_monthly_recurring_revenue",
            ),
            suggested_prompt="How can I convert more of my trialing revenue?",
        )
