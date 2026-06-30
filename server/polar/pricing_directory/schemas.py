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


class FeatureKey(StrEnum):
    """Canonical, comparable features. See feature_catalog.py for labels."""

    sso = "sso"
    scim = "scim"
    rbac = "rbac"
    mfa = "mfa"
    audit_logs = "audit_logs"
    soc2 = "soc2"
    hipaa = "hipaa"
    iso27001 = "iso27001"
    encryption = "encryption"
    sla = "sla"
    priority_support = "priority_support"
    dedicated_manager = "dedicated_manager"
    onboarding = "onboarding"
    self_hosted = "self_hosted"
    private_cloud = "private_cloud"
    multi_region = "multi_region"
    data_residency = "data_residency"
    byok = "byok"
    api_access = "api_access"
    webhooks = "webhooks"
    integrations = "integrations"
    seats_included = "seats_included"
    unlimited_seats = "unlimited_seats"
    guest_access = "guest_access"
    storage = "storage"
    data_retention = "data_retention"
    free_tier = "free_tier"
    free_trial = "free_trial"
    annual_discount = "annual_discount"
    advanced_analytics = "advanced_analytics"
    custom_branding = "custom_branding"
    invoicing = "invoicing"


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
    key: FeatureKey = Field(
        description="Which canonical feature this plan includes."
    )
    value: str | None = Field(
        default=None,
        description="A quantity or limit if stated, e.g. '100 GB', 'Unlimited'.",
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
            "Which canonical features (from the provided list) this plan "
            "includes, with a value where one is stated."
        ),
    )
    other_features: list[str] = Field(
        default_factory=list,
        description=(
            "Notable features the plan advertises that do NOT map to any "
            "canonical feature — kept for catalog discovery, verbatim."
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
    anchor: str
    name: str
    key: str
    category: str
    value: str | None


class FeatureGatingRow(Schema):
    """For one feature, the cheapest plan per company that includes it."""

    company: str
    company_slug: str
    plan: str
    anchor: str
    value: str | None


class CatalogFeatureSchema(Schema):
    key: str
    label: str
    category: str


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
