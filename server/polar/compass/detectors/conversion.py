from ..schemas import Insight, InsightAction, InsightCategory, InsightSeverity
from ..signals import format_pct, series
from .base import Detector, DetectorContext, confidence_for_sample

_WINDOW_DAYS = 30
# A month-over-month swing of at least 5 percentage points is a real move.
_MATERIAL_MOVE = 0.05
# Need a prior baseline with enough volume to compare against.
_MIN_PRIOR_CHECKOUTS = 5


class CheckoutConversionDetector(Detector):
    """
    Month-over-month movement in checkout conversion.

    A falling checkout→purchase rate points at pricing or checkout friction, the
    kind of leak a merchant can actually fix. Day-level conversion is too noisy to
    read, so this rolls the raw `checkouts`/`succeeded_checkouts` counts into two
    30-day windows and compares the rates. Confidence is gated on recent checkout
    volume so a couple of abandoned carts don't read as a collapse.
    """

    id = "checkout_conversion"
    category = InsightCategory.product
    category_label = "Conversion"
    priority = 35
    metric_slugs = ("checkouts", "succeeded_checkouts")
    lookback_days = 2 * _WINDOW_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        response = ctx.metrics

        checkouts = series(response, "checkouts")
        succeeded = series(response, "succeeded_checkouts")
        if len(checkouts) <= _WINDOW_DAYS:
            return None

        recent_checkouts = sum(checkouts[-_WINDOW_DAYS:])
        sample_n = int(recent_checkouts)
        confidence = confidence_for_sample(sample_n)
        if confidence is None:
            return None

        prior_checkouts = sum(checkouts[-2 * _WINDOW_DAYS : -_WINDOW_DAYS])
        if prior_checkouts < _MIN_PRIOR_CHECKOUTS:
            return None

        recent_succeeded = sum(succeeded[-_WINDOW_DAYS:])
        prior_succeeded = sum(succeeded[-2 * _WINDOW_DAYS : -_WINDOW_DAYS])
        recent_rate = recent_succeeded / recent_checkouts
        prior_rate = prior_succeeded / prior_checkouts

        move = recent_rate - prior_rate
        if abs(move) < _MATERIAL_MOVE:
            return None

        dropped = move < 0
        points = f"{abs(move) * 100:.0f} points"
        rate_str = format_pct(recent_rate)
        title = (
            f"Checkout conversion fell to {rate_str}"
            if dropped
            else f"Checkout conversion rose to {rate_str}"
        )
        body = (
            f"{int(recent_succeeded)} of {int(recent_checkouts)} checkouts "
            f"converted in the last 30 days ({rate_str}), "
            f"{'down' if dropped else 'up'} {points} from "
            f"{format_pct(prior_rate)} the prior 30 days."
        )
        why = (
            "Triggered by a month-over-month change in checkout conversion of at "
            f"least 5 points across {sample_n} recent checkouts "
            f"({confidence.value} confidence)."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=InsightSeverity.warning
            if dropped
            else InsightSeverity.opportunity,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=InsightAction(
                label="View conversion",
                metric="checkouts_conversion",
            ),
        )
