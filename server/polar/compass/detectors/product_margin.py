import math

from polar.kit.currency import get_currency_decimal_factor
from polar.metrics.aggregation import latest

from ..schemas import (
    AdjustPriceAction,
    Insight,
    InsightCategory,
    InsightSeverity,
)
from ..signals import ProductPricing, format_currency, format_pct
from .base import Detector, DetectorContext, confidence_for_sample

# Below this a product's margin is thin enough to flag; below the critical bar
# it leads the feed.
_HEALTHY_MARGIN = 0.70
_CRITICAL_MARGIN = 0.40
# The reference price restores this margin at the current cost to serve.
_TARGET_MARGIN = 0.70


def _suggested_price(price_amount: int, margin: float, currency: str) -> int | None:
    """List price (smallest currency unit) restoring the target margin, or None.

    Derived from the unitless margin — `price * (1 - margin)` is the cost to
    serve in the price's own currency unit — so it never depends on the raw
    cost metric's unit. Rounded up to a whole major unit (the next dollar for
    cent-based currencies, the next yen for zero-decimal ones); only a raise
    is ever suggested (a lower price never *restores* margin).
    """
    cost_share = 1 - margin
    if cost_share <= 0:
        return None
    target = price_amount * cost_share / (1 - _TARGET_MARGIN)
    factor = get_currency_decimal_factor(currency)
    suggested = math.ceil(target / factor) * factor
    return suggested if suggested > price_amount else None


class ProductMarginDetector(Detector):
    """
    The product with the weakest unit economics, with a pricing lever.

    Where the org-level margin detector *announces* compression, this one
    *attributes* it: it names the product whose gross margin is thinnest and
    offers a reference price that would restore the target margin at the
    current cost to serve. The suggestion deliberately ignores demand
    elasticity — it's a reference point for the merchant, never applied
    automatically, and affects new customers only.

    Cost attribution: cost events attach to customers, not products, so the
    service reads costs through the product's active-customer cohort (revenue
    stays product-filtered). A customer holding several products has their full
    cost counted toward each, which skews margins pessimistic for orgs whose
    customers stack products — a product-attributed cost pipe is the eventual
    fix. Confidence is gated on the product's own subscription count.
    """

    id = "product_margin"
    category = InsightCategory.cost
    category_label = "Margin"
    priority = 12
    metric_slugs = ("gross_margin_percentage",)
    product_metric_slugs = ("gross_margin_percentage", "active_subscriptions")

    def evaluate(self, ctx: DetectorContext) -> Insight | None:
        worst: ProductPricing | None = None
        worst_margin = _HEALTHY_MARGIN
        worst_subs = 0
        for product in ctx.products:
            margin = latest(product.metrics, "gross_margin_percentage")
            # 0 margin means no cost/revenue data for this product, not a
            # zero-margin business — stay silent rather than mislead.
            if margin <= 0 or margin >= worst_margin:
                continue
            subs = int(latest(product.metrics, "active_subscriptions"))
            if confidence_for_sample(subs) is None:
                continue
            worst = product
            worst_margin = margin
            worst_subs = subs

        if worst is None:
            return None

        confidence = confidence_for_sample(worst_subs)
        if confidence is None:
            return None

        cost_to_serve = round(worst.price_amount * (1 - worst_margin))
        suggested = _suggested_price(worst.price_amount, worst_margin, worst.currency)
        margin_str = format_pct(worst_margin)

        title = f"{worst.name} margin is down to {margin_str}"
        body = (
            f"{worst.name} keeps {margin_str} of its "
            f"{format_currency(worst.price_amount)} price after costs. "
            f"Roughly {format_currency(cost_to_serve)} per customer goes to "
            f"serving it, across {worst_subs} active subscriptions."
        )
        if suggested is not None:
            body += (
                f" A list price around {format_currency(suggested)} would "
                f"restore a {format_pct(_TARGET_MARGIN)} margin for new "
                "customers."
            )
        why = (
            f"Triggered when a product's gross margin falls below "
            f"{format_pct(_HEALTHY_MARGIN)}, weighted by its "
            f"{worst_subs} active subscriptions ({confidence.value} "
            "confidence). Costs are attributed to the customers subscribed to "
            "the product, so customers holding several products weigh on each "
            "of them. The suggested price is the level that restores a "
            f"{format_pct(_TARGET_MARGIN)} margin at the current cost to "
            "serve; it does not model demand."
        )

        return self.build_insight(
            ctx,
            period_bucket=ctx.today.strftime("%Y-%m"),
            severity=(
                InsightSeverity.critical
                if worst_margin < _CRITICAL_MARGIN
                else InsightSeverity.warning
            ),
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=AdjustPriceAction(
                label=f"Review {worst.name} pricing",
                product_id=worst.product_id,
                product_name=worst.name,
                current_price_amount=worst.price_amount,
                suggested_price_amount=suggested,
                currency=worst.currency,
            ),
        )
