from enum import StrEnum
from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, Field

from polar.kit.schemas import Schema


class InsightCategory(StrEnum):
    """Buckets an insight by which aspect of the business it speaks to."""

    revenue = "revenue"
    retention = "retention"
    growth = "growth"
    risk = "risk"
    cost = "cost"
    product = "product"


class ConfidenceLevel(StrEnum):
    """
    How much we trust an insight, derived from sample size and baseline variance.

    Low-confidence insights are softened or suppressed so small merchants don't
    get noise (e.g. "churn doubled" off a 1 -> 2 customer change).
    """

    low = "low"
    medium = "medium"
    high = "high"


class InsightSeverity(StrEnum):
    """
    How much the merchant should care, assigned per insight by its detector.

    This is a property of what was *found*, not of the detector: the same MRR
    detector emits `warning` when revenue falls and `info` when it grows. The
    feed is ordered by severity first, so the most consequential reading always
    leads.
    """

    critical = "critical"
    """Actively losing money or a risk that needs action now."""
    warning = "warning"
    """A negative trend worth attention soon."""
    opportunity = "opportunity"
    """A positive lever worth pulling (savings, upsell, pricing)."""
    info = "info"
    """Notable movement; no action required."""


class InsightActionType(StrEnum):
    """
    What kind of action an insight offers.

    Actions are a discriminated union on this type: adding a new kind of action
    is adding one enum member, one schema below (folded into `InsightAction`),
    and one resolver entry on the client — the client owns all routing, the
    backend only names the domain object the action concerns.
    """

    view_metric = "view_metric"
    adjust_price = "adjust_price"


class ViewMetricAction(Schema):
    """A drill-down that points at the metric behind the insight."""

    type: Literal[InsightActionType.view_metric] = InsightActionType.view_metric
    label: str = Field(description="Button label.")
    metric: str = Field(
        description=(
            "Slug of the metric this insight is about (e.g. "
            "`monthly_recurring_revenue`). The client owns the routing and "
            "resolves it to the matching analytics page."
        )
    )


class AdjustPriceAction(Schema):
    """
    A recommendation to review a product's pricing, with a reference point.

    The suggested amount is a *reference*, not a mandate: it's the list price
    that would restore the target gross margin at the current cost to serve,
    ignoring demand elasticity. It applies to new customers only — existing
    subscriptions keep their price. The client routes to the product's pricing
    editor; nothing is ever applied automatically.
    """

    type: Literal[InsightActionType.adjust_price] = InsightActionType.adjust_price
    label: str = Field(description="Button label.")
    product_id: UUID4 = Field(description="The product whose pricing to review.")
    product_name: str = Field(description="Display name of the product.")
    current_price_amount: int = Field(
        description="The product's current list price, in cents."
    )
    suggested_price_amount: int | None = Field(
        default=None,
        description=(
            "Reference list price (cents) that would restore the target gross "
            "margin at the current cost to serve. Null when no meaningful "
            "suggestion can be computed."
        ),
    )
    currency: str = Field(description="ISO currency code of the amounts.")


InsightAction = Annotated[
    ViewMetricAction | AdjustPriceAction,
    Discriminator("type"),
]


class InsightDriver(Schema):
    """
    One contributor to the headline change.

    Decomposition is what makes an insight *explain* rather than *announce* — e.g.
    "MRR grew 12%, ~70% of it from Pro upgrades". Populated by a grouped query; the
    MRR scaffold leaves this empty until a dedicated Tinybird breakdown pipe lands.
    """

    dimension: str = Field(
        description="What the drivers are grouped by, e.g. `product`."
    )
    label: str = Field(description="Human-readable name of this driver.")
    contribution_pct: float = Field(
        description="Share of the headline change attributable to this driver (0-1)."
    )
    value: float = Field(description="This driver's contribution in the metric's unit.")


class Insight(Schema):
    """A computed, narrated reading of the business with a drill-down."""

    id: str = Field(
        description=(
            "Deterministic insight key (`detector_id:organization_id:period_bucket`). "
            "Stable across recomputes so dismissals and feedback re-attach."
        )
    )
    detector_id: str = Field(description="The detector that produced this insight.")
    category: InsightCategory
    category_label: str = Field(description="Visible label next to the category dot.")
    severity: InsightSeverity = Field(
        description="How much the merchant should care; the feed sorts on this first."
    )
    title: str
    body: str
    why: str | None = Field(
        default=None,
        description="Explanation surfaced via the 'Why you're seeing this' link.",
    )
    confidence: ConfidenceLevel
    primary_action: InsightAction | None = None
    drivers: list[InsightDriver] = Field(
        default_factory=list,
        description="Top contributors to the headline change.",
    )
