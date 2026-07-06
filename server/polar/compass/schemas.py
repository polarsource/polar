from enum import StrEnum

from pydantic import Field

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


class InsightAction(Schema):
    """A drill-down that points at the metric behind the insight."""

    label: str = Field(description="Button label.")
    metric: str = Field(
        description=(
            "Slug of the metric this insight is about (e.g. "
            "`monthly_recurring_revenue`). The client owns the routing and "
            "resolves it to the matching analytics page."
        )
    )


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
