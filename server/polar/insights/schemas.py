from enum import StrEnum

from pydantic import Field

from polar.kit.schemas import Schema
from polar.models.insight_feedback import InsightFeedbackAction


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


class InsightAction(Schema):
    """A drill-down link that proves or acts on the insight."""

    label: str = Field(description="Button label.")
    href: str = Field(description="Where the action takes the merchant.")


class InsightDriver(Schema):
    """
    One contributor to the headline change.

    Decomposition is what makes an insight *explain* rather than *announce* — e.g.
    "MRR grew 12%, ~70% of it from Pro upgrades". Populated by a grouped query; the
    MRR scaffold leaves this empty until a dedicated Tinybird breakdown pipe lands.
    """

    dimension: str = Field(description="What the drivers are grouped by, e.g. `product`.")
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
    rejectable: bool = Field(
        default=True,
        description="When true, render a 'Not useful' button alongside Dismiss.",
    )


class InsightFeedbackCreate(Schema):
    """A merchant's reaction to an insight."""

    action: InsightFeedbackAction = Field(
        description="`dismiss` hides the insight; `not_useful` is a negative quality signal."
    )


class InsightFeedbackResponse(Schema):
    """Acknowledges recorded feedback."""

    insight_key: str
    action: InsightFeedbackAction
