from datetime import datetime
from enum import StrEnum

from pydantic import Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class PricingModelType(StrEnum):
    usage = "Usage"
    seat = "Seat"
    tiered = "Tiered"
    hybrid = "Hybrid"
    flat = "Flat"


class ChangeDirection(StrEnum):
    up = "up"
    down = "down"
    new = "new"


class MetricUnit(StrEnum):
    tokens = "tokens"
    seat = "seat"
    workspace = "workspace"
    project = "project"
    request = "request"
    gb_month = "gb_month"
    gb = "gb"
    bandwidth_gb = "bandwidth_gb"
    gpu_second = "gpu_second"
    cpu_second = "cpu_second"
    build_minute = "build_minute"
    minute = "minute"
    hour = "hour"
    other = "other"


class FeatureCategory(StrEnum):
    access_control = "access_control"
    security_compliance = "security_compliance"
    support = "support"
    collaboration = "collaboration"
    usage_limits = "usage_limits"
    integrations = "integrations"
    deployment = "deployment"
    data_privacy = "data_privacy"
    analytics = "analytics"
    ai_capabilities = "ai_capabilities"
    administration = "administration"
    customization = "customization"
    other = "other"


# --- LLM extraction output ---------------------------------------------------


class ExtractedMetric(Schema):
    label: str = Field(
        description="What the price is for, e.g. 'Input tokens', 'Storage'."
    )
    unit: MetricUnit = Field(
        description="The canonical unit this price is charged per."
    )
    amount: float = Field(description="The numeric price, in `currency`.")
    per_quantity: float = Field(
        default=1,
        description=(
            "How many units `amount` covers. Use 1000 for 'per 1K', 1000000 "
            "for 'per M', so amount/per_quantity is the price of one unit."
        ),
    )
    currency: str = Field(default="USD", description="ISO currency code.")
    raw: str = Field(description="The original price text, e.g. '$2.50 / M tokens'.")


class ExtractedFeature(Schema):
    name: str = Field(
        description="The feature or entitlement as written, e.g. 'Single sign-on'."
    )
    key: str = Field(
        description=(
            "A short normalized slug for the feature so it can be compared "
            "across companies, e.g. 'sso', 'audit_logs', 'priority_support'."
        )
    )
    category: FeatureCategory = Field(
        description="The theme this feature belongs to."
    )
    value: str | None = Field(
        default=None,
        description="A quantity or limit if any, e.g. '100 GB', 'Unlimited', '5'.",
    )


class ExtractedProduct(Schema):
    name: str = Field(description="Name of the plan or product, e.g. 'Pro' or 'API'.")
    model: PricingModelType = Field(
        description="The pricing model that best describes this product."
    )
    anchor: str = Field(
        description=(
            "One short, representative price a human would recognise, e.g. "
            "'$20 / user / mo', '$2.50 / M tokens', '$25 / mo Pro', or 'Custom'."
        )
    )
    metrics: list[ExtractedMetric] = Field(
        default_factory=list,
        description=(
            "Every per-unit rate this plan charges (token rates, compute, "
            "storage, overages). Empty if the plan is a flat price only."
        ),
    )
    features: list[ExtractedFeature] = Field(
        default_factory=list,
        description=(
            "Notable features, benefits, and entitlements this plan includes "
            "(SSO, audit logs, support level, limits, integrations, ...)."
        ),
    )


class ExtractedPricing(Schema):
    products: list[ExtractedProduct] = Field(
        description="Every distinct paid product or plan found on the page."
    )
    confidence: float = Field(
        ge=0,
        le=1,
        description="0-1 confidence that the extraction is accurate and complete.",
    )


# --- Read schemas (for the directory API) ------------------------------------


class PricingSnapshotSchema(IDSchema):
    captured_at: datetime
    model: str
    anchor: str
    direction: ChangeDirection


class PricingMetricSchema(IDSchema):
    label: str
    unit: str
    amount: float
    per_quantity: float
    currency: str


class PricingFeatureSchema(IDSchema):
    name: str
    key: str
    category: str
    value: str | None


class PricingProductSummary(IDSchema):
    name: str
    status: str
    current_model: str
    current_anchor: str
    last_direction: ChangeDirection
    last_change_at: datetime


class PricingProductSchema(PricingProductSummary):
    snapshots: list[PricingSnapshotSchema]
    metrics: list[PricingMetricSchema]
    features: list[PricingFeatureSchema]


class PriceComparisonRow(Schema):
    company: str
    company_slug: str
    product: str
    label: str
    unit: str
    amount: float
    per_quantity: float
    currency: str
    unit_price: float


class PricingFeatureRow(Schema):
    company: str
    company_slug: str
    product: str
    name: str
    key: str
    category: str
    value: str | None


class PricingCompanySummary(IDSchema, TimestampedSchema):
    slug: str
    name: str
    category: str
    summary: str | None
    products: list[PricingProductSummary]


class PricingCompanySchema(IDSchema, TimestampedSchema):
    slug: str
    name: str
    category: str
    summary: str | None
    products: list[PricingProductSchema]


class PricingChangeSchema(Schema):
    date: datetime
    company: str
    company_slug: str
    product: str
    model: str
    anchor: str
    direction: ChangeDirection
