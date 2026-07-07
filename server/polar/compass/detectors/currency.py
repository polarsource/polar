from ..schemas import AddCurrencyAction, Insight, InsightCategory, InsightSeverity
from ..signals import format_pct
from .base import Detector, DetectorContext, confidence_for_sample

_WINDOW_DAYS = 30
# Below this share, local pricing is a nice-to-have; above it the merchant is
# leaving conversion on the table in a market they already sell into.
_MIN_REVENUE_SHARE = 0.15


class CurrencyOpportunityDetector(Detector):
    """
    Meaningful revenue from countries whose currency the merchant ignores.

    The first expansion insight rather than a problem report: customers are
    already paying from markets with an unconfigured presentment currency,
    and local pricing typically lifts international conversion. Fed by the
    service's currency prefetch (orders grouped by billing country, resolved
    to presentment currencies, configured ones dropped), keeping the detector
    pure.
    """

    id = "currency_opportunity"
    category = InsightCategory.growth
    category_label = "Growth"
    priority = 30
    metric_slugs = ()
    needs_currency_signals = True
    lookback_days = _WINDOW_DAYS

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        if not ctx.currency_signals:
            return None
        top = ctx.currency_signals[0]
        if top.revenue_share < _MIN_REVENUE_SHARE:
            return None

        confidence = confidence_for_sample(top.order_count)
        if confidence is None:
            return None

        currency = top.currency.upper()
        countries = ", ".join(top.countries)
        title = (
            f"{format_pct(top.revenue_share)} of revenue comes from "
            f"{currency} countries"
        )
        body = (
            f"Customers in {countries} generated "
            f"{format_pct(top.revenue_share)} of your paid revenue in the "
            f"last {_WINDOW_DAYS} days across {top.order_count} orders. Your "
            f"products have no {currency} price. Local pricing typically "
            "improves international conversion."
        )
        why = (
            f"Triggered when countries sharing an unconfigured presentment "
            f"currency exceed {format_pct(_MIN_REVENUE_SHARE)} of paid "
            f"revenue, over {top.order_count} orders ({confidence.value} "
            "confidence). Revenue is attributed by order billing country."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=InsightSeverity.opportunity,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=AddCurrencyAction(
                label=f"Add {currency} pricing", currency=top.currency
            ),
        )
