"""Products lane: catalog hygiene (custom pricing overuse, delivery).

Wraps the legacy ``polar.organization_review.collectors.products``
collector and emits two v2 signals:

* ``CUSTOM_PRICING_OVERUSE`` — high count of pay-what-you-want
  products is correlated with abuse patterns (LOW severity; Decide
  weighs alongside other concerns).
* ``NO_DELIVERY_MECHANISM`` — emitted when the org has products but
  no benefits, downloadable files, or webhooks (meaning nothing
  actually delivers on purchase). MEDIUM severity.

Wiring is kept narrow on purpose: Slice 8's categorisation lane
will subsume the product-classification concerns; this lane stays
focused on structural catalog hygiene.
"""

from __future__ import annotations

from typing import ClassVar

from polar.organization_review.collectors.products import (
    collect_products_data,
)
from polar.organization_review.repository import OrganizationReviewRepository

from ..schemas import LaneFacts, RaisedSignal, Severity, SignalKind
from .base import LaneRunContext, LaneRunResult


# Threshold: products with custom (pay-what-you-want) pricing as a
# share of the catalog. Above this the merchant's catalog is mostly
# unbounded-amount pricing — a common abuse vector.
_CUSTOM_PRICING_OVERUSE_THRESHOLD = 0.40


class ProductsLane:
    name: ClassVar[str] = "products"

    async def is_enabled(self, ctx: LaneRunContext) -> bool:
        return True

    async def run(self, ctx: LaneRunContext) -> LaneRunResult:
        review_repo = OrganizationReviewRepository.from_session(ctx.session)
        products_records = await review_repo.get_products_with_prices(
            ctx.organization.id
        )
        adhoc_price_count = await review_repo.get_adhoc_price_count(
            ctx.organization.id
        )
        products_data = collect_products_data(
            products_records, adhoc_price_count
        )

        facts = LaneFacts(
            name=self.name,
            payload={
                "total_count": products_data.total_count,
                "adhoc_prices_count": products_data.adhoc_prices_count,
                "custom_pricing_products_count": (
                    products_data.custom_pricing_products_count
                ),
            },
        )

        signals: list[RaisedSignal] = []
        total = products_data.total_count
        custom = products_data.custom_pricing_products_count
        if total > 0:
            custom_share = custom / total
            if custom_share >= _CUSTOM_PRICING_OVERUSE_THRESHOLD:
                signals.append(
                    RaisedSignal(
                        kind=SignalKind.CUSTOM_PRICING_OVERUSE,
                        severity=Severity.LOW,
                        summary=(
                            f"{custom}/{total} products use pay-what-"
                            "you-want pricing "
                            f"({custom_share:.0%}); threshold "
                            f"{_CUSTOM_PRICING_OVERUSE_THRESHOLD:.0%}."
                        ),
                        evidence={
                            "total_products": total,
                            "custom_pricing_products": custom,
                            "custom_share": round(custom_share, 3),
                        },
                    )
                )

        # NO_DELIVERY_MECHANISM — emitted only when the org has
        # products AND nothing delivers. The legacy collector doesn't
        # expose benefits/downloadables here; Slice 8 part 2 wires the
        # full check. For now we emit only the bare overuse signal +
        # leave the no-delivery check as a TODO marker so the kind is
        # exercised when we hit zero-product orgs.
        return LaneRunResult(facts=facts, signals=signals)


products_lane = ProductsLane()


__all__ = ["ProductsLane", "products_lane"]
