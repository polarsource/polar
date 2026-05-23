"""Categorisation lane: proposes organization facets (Slice 8).

Reads the merchant's self-declared ``OrganizationDetails`` and
proposes normalised facets (product_category, pricing_model,
customer_acquisition). Lanes are pure — this one does NOT write to
``organization_facets``; it emits the proposals in its
``LaneFacts.payload`` under ``proposed_facets``. The backoffice
confirm action (or the day-1 backfill in the service) is what
persists them.

Emits ``MERCHANT_DECLARATION_MISMATCH`` (LOW) when the merchant
declared selling categories but provided no product description to
corroborate them — a cheap, no-LLM signal that the declaration may
be unsubstantiated. Richer AI-derived categorisation (from website +
catalog) layers on in a later slice; this establishes the facet
pipeline end to end first.
"""

from __future__ import annotations

from typing import ClassVar

from ..schemas import LaneFacts, RaisedSignal, Severity, SignalKind
from .base import LaneRunContext, LaneRunResult


# Maps OrganizationDetails keys -> facet namespace.
_DETAIL_TO_NAMESPACE: dict[str, str] = {
    "selling_categories": "product_category",
    "pricing_models": "pricing_model",
    "customer_acquisition": "customer_acquisition",
}


class CategorisationLane:
    name: ClassVar[str] = "categorisation"

    async def is_enabled(self, ctx: LaneRunContext) -> bool:
        # Only meaningful once the merchant has submitted details.
        return bool(ctx.organization.details)

    async def run(self, ctx: LaneRunContext) -> LaneRunResult:
        details = ctx.organization.details or {}

        proposed: list[dict[str, str]] = []
        for detail_key, namespace in _DETAIL_TO_NAMESPACE.items():
            values = details.get(detail_key) or []
            if isinstance(values, str):
                values = [values]
            for value in values:
                normalised = _normalise(value)
                if normalised:
                    proposed.append(
                        {"namespace": namespace, "value": normalised}
                    )

        facts = LaneFacts(
            name=self.name,
            payload={
                "proposed_facets": proposed,
                "has_product_description": bool(
                    details.get("product_description")
                ),
                "declared_category_count": len(
                    details.get("selling_categories") or []
                ),
            },
        )

        signals: list[RaisedSignal] = []
        declared_categories = details.get("selling_categories") or []
        if declared_categories and not details.get("product_description"):
            signals.append(
                RaisedSignal(
                    kind=SignalKind.MERCHANT_DECLARATION_MISMATCH,
                    severity=Severity.LOW,
                    summary=(
                        f"Merchant declared {len(declared_categories)} "
                        "selling categor(y/ies) but provided no product "
                        "description to corroborate them."
                    ),
                    evidence={
                        "selling_categories": list(declared_categories),
                        "product_description": None,
                    },
                )
            )

        return LaneRunResult(facts=facts, signals=signals)


def _normalise(value: str) -> str:
    """Lowercase + hierarchical dotted path from a declared category.

    "Software / SaaS" -> "software.saas". Keeps it deterministic so
    the same declaration always maps to the same facet value (the
    upsert key).
    """

    parts = [
        segment.strip().lower().replace(" ", "_")
        for segment in value.replace("/", ".").split(".")
        if segment.strip()
    ]
    return ".".join(parts)


categorisation_lane = CategorisationLane()


__all__ = ["CategorisationLane", "categorisation_lane", "_normalise"]
