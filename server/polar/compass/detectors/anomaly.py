from ..schemas import (
    ConfidenceLevel,
    Insight,
    InsightCategory,
    InsightSeverity,
    ViewCostsAction,
)
from ..signals import format_currency
from .base import Detector, DetectorContext

_WINDOW_DAYS = 30
# A p99 outlier always exists in any distribution, so top-percentile membership
# is not news. Only flag when the largest trace runs well past the typical
# event for its name. A genuine spike, not the tail of a normal spread.
_MIN_SPIKE_RATIO = 3.0
_CRITICAL_SPIKE_RATIO = 6.0
# Below this, a 3x jump is rounding noise dressed as a spike; skip it.
_MIN_TOTAL_COST = 100.0


class CostAnomalyDetector(Detector):
    """
    Cost traces that ran far past their event's normal range.

    The costs page lists per-trace outliers; this narrates the aggregate: which
    event name is spiking, how far past typical, and the total it cost. Because
    a p99 outlier always exists, the detector gates on magnitude. The largest
    trace must clear a multiple of the event's average, so it speaks only when
    costs genuinely jumped. Fed by the service's variance prefetch, keeping the
    detector pure.
    """

    id = "cost_anomaly"
    category = InsightCategory.cost
    category_label = "Costs"
    priority = 16
    metric_slugs = ()
    needs_cost_anomalies = True
    lookback_days = _WINDOW_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        top = next(
            (
                signal
                for signal in ctx.cost_anomalies
                if signal.spike_ratio >= _MIN_SPIKE_RATIO
                and signal.total_amount >= _MIN_TOTAL_COST
            ),
            None,
        )
        if top is None:
            return None

        # Clarity of the pattern, not sample size: a single real spike is worth
        # surfacing regardless of merchant size, but repeated outliers of the
        # same event are unambiguously a trend.
        confidence = (
            ConfidenceLevel.high
            if top.anomaly_count >= 5
            else ConfidenceLevel.medium
            if top.anomaly_count >= 2
            else ConfidenceLevel.low
        )
        multiple = round(top.spike_ratio)
        events_word = "event" if top.anomaly_count == 1 else "events"

        title = f"Cost spike in {top.event_name}"
        body = (
            f"{top.anomaly_count} {top.event_name} {events_word} cost "
            f"{format_currency(top.total_amount)} in the last {_WINDOW_DAYS} "
            f"days, the largest single trace reaching "
            f"{format_currency(top.max_amount)}. That is about {multiple}x the "
            f"typical {format_currency(top.average_amount)} for this event."
        )
        why = (
            f"Triggered when an event's largest cost trace exceeds "
            f"{round(_MIN_SPIKE_RATIO)}x its average over {_WINDOW_DAYS} days, "
            f"across {top.anomaly_count} outlier {events_word} "
            f"({confidence.value} confidence). An outlier is a root event at or "
            "above the p99 cost for its name."
        )

        # One key per event name per month: a different event spiking later in
        # the same month is a different finding and must not inherit this one's
        # dismissal or feedback. The key separator (`:`) is reserved, so it is
        # replaced in the name.
        bucket = f"{ctx.today.strftime('%Y-%m')}/{top.event_name.replace(':', '_')}"
        return self.build_insight(
            ctx,
            period_bucket=bucket,
            severity=(
                InsightSeverity.critical
                if top.spike_ratio >= _CRITICAL_SPIKE_RATIO
                else InsightSeverity.warning
            ),
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=ViewCostsAction(
                label="View cost event", event_id=top.max_event_id
            ),
            suggested_prompt=f"What's causing the cost spike in {top.event_name}?",
        )
