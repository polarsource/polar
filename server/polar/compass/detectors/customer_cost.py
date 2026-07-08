from ..schemas import Insight, InsightCategory, InsightSeverity, ViewMetricAction
from ..signals import CUSTOMER_COSTS_SAMPLE_LIMIT, format_pct
from .base import Detector, DetectorContext, confidence_for_sample

# Below this share, cost skew is normal; above the critical bar one outage or
# churn event materially moves the whole cost base.
_CONCENTRATION_WARNING = 0.40
_CONCENTRATION_CRITICAL = 0.60
_LOOKBACK_DAYS = 30


class CostConcentrationDetector(Detector):
    """
    One customer dominating the organization's tracked costs.

    Reads the per-customer cost ranking (from `_cost` event statistics) the
    service prefetches. Concentration is a *risk* reading: if a single
    customer drives most of the cost base, their behavior (a runaway workload,
    a plan change, churn) swings the whole margin. Confidence is gated on how
    many customers carry costs at all, so a two-customer org doesn't get told
    its costs are "concentrated".
    """

    id = "cost_concentration"
    category = InsightCategory.risk
    category_label = "Risk"
    priority = 25
    metric_slugs = ()
    needs_customer_costs = True
    lookback_days = _LOOKBACK_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        ranked = [signal for signal in ctx.customer_costs if signal.amount > 0]
        if not ranked:
            return None

        confidence = confidence_for_sample(len(ranked))
        if confidence is None:
            return None

        top = max(ranked, key=lambda signal: signal.share)
        if top.share < _CONCENTRATION_WARNING:
            return None

        share_str = format_pct(top.share)
        count_str = (
            f"at least {len(ranked)}"
            if len(ranked) >= CUSTOMER_COSTS_SAMPLE_LIMIT
            else str(len(ranked))
        )
        title = f"One customer drives {share_str} of your costs"
        body = (
            f"{top.label} generated {share_str} of all tracked costs in the "
            f"last {_LOOKBACK_DAYS} days, across {count_str} customers with "
            "costs. A single workload change or churn event would move most "
            "of your cost base."
        )
        why = (
            f"Triggered when one customer exceeds "
            f"{format_pct(_CONCENTRATION_WARNING)} of tracked costs, across "
            f"{count_str} customers with cost data ({confidence.value} "
            "confidence). Costs come from `_cost` event metadata."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=(
                InsightSeverity.critical
                if top.share >= _CONCENTRATION_CRITICAL
                else InsightSeverity.warning
            ),
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=ViewMetricAction(label="View costs", metric="costs"),
            suggested_prompt="Which customers drive most of my costs?",
        )
