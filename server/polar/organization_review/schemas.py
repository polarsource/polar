from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import Field

from polar.kit.schemas import Schema

# --- Review context ---


class ReviewContext(StrEnum):
    SUBMISSION = "submission"  # First review at details submission time
    THRESHOLD = "threshold"  # Following reviews when payment threshold hit


# --- Collector output schemas ---


class OrganizationData(Schema):
    name: str
    slug: str
    website: str | None = None
    email: str | None = None
    about: str | None = None
    product_description: str | None = None
    intended_use: str | None = None
    customer_acquisition: list[str] = Field(default_factory=list)
    future_annual_revenue: int | None = None
    switching_from: str | None = None
    previous_annual_revenue: int | None = None
    socials: list[dict[str, str]] = Field(default_factory=list)
    created_at: datetime | None = None
    details_submitted_at: datetime | None = None
    blocked_at: datetime | None = None


class ProductData(Schema):
    name: str
    description: str | None = None
    billing_type: str | None = None
    visibility: str | None = None
    is_archived: bool = False
    prices: list[dict[str, Any]] = Field(default_factory=list)


class ProductsData(Schema):
    products: list[ProductData] = Field(default_factory=list)
    total_count: int = 0


class AccountData(Schema):
    country: str | None = None
    currency: str | None = None
    business_type: str | None = None
    is_details_submitted: bool = False
    is_charges_enabled: bool = False
    is_payouts_enabled: bool = False
    identity_verification_status: str | None = None


class PaymentMetrics(Schema):
    total_payments: int = 0
    succeeded_payments: int = 0
    total_amount_cents: int = 0
    risk_scores: list[int] = Field(default_factory=list)
    p50_risk_score: int | None = None
    p90_risk_score: int | None = None
    refund_count: int = 0
    refund_amount_cents: int = 0
    dispute_count: int = 0
    dispute_amount_cents: int = 0


class PriorOrganization(Schema):
    slug: str
    status: str
    review_verdict: str | None = None
    appeal_decision: str | None = None
    blocked_at: datetime | None = None


class HistoryData(Schema):
    user_email: str | None = None
    user_blocked_at: datetime | None = None
    prior_organizations: list[PriorOrganization] = Field(default_factory=list)
    has_prior_denials: bool = False
    has_blocked_orgs: bool = False


class WebsitePage(Schema):
    url: str
    title: str | None = None
    content: str = Field(default="", description="Extracted text content")
    content_truncated: bool = False


class WebsiteData(Schema):
    base_url: str
    pages: list[WebsitePage] = Field(default_factory=list)
    summary: str | None = Field(
        default=None, description="AI-generated summary of website content"
    )
    scrape_error: str | None = None
    total_pages_attempted: int = 0
    total_pages_succeeded: int = 0


class DataSnapshot(Schema):
    """All collected data for the AI analyzer."""

    context: ReviewContext
    organization: OrganizationData
    products: ProductsData
    account: AccountData
    metrics: PaymentMetrics
    history: HistoryData
    website: WebsiteData | None = None
    collected_at: datetime


# --- AI Analyzer output schemas ---


class ReviewDimension(StrEnum):
    POLICY_COMPLIANCE = "policy_compliance"
    PRODUCT_LEGITIMACY = "product_legitimacy"
    IDENTITY_TRUST = "identity_trust"
    FINANCIAL_RISK = "financial_risk"
    PRIOR_HISTORY = "prior_history"


class DimensionAssessment(Schema):
    dimension: ReviewDimension = Field(
        description="The review dimension being assessed"
    )
    score: float = Field(
        ge=0, le=100, description="Risk score 0-100 (0=no risk, 100=highest risk)"
    )
    confidence: float = Field(
        ge=0,
        le=1,
        description="Confidence in this assessment 0-1",
    )
    findings: list[str] = Field(
        default_factory=list,
        description="Specific findings for this dimension",
    )
    recommendation: str = Field(
        description="Brief recommendation for this dimension",
    )


class ReviewVerdict(StrEnum):
    APPROVE = "APPROVE"
    DENY = "DENY"
    NEEDS_HUMAN_REVIEW = "NEEDS_HUMAN_REVIEW"


class ReviewAgentReport(Schema):
    """Structured output from the AI review agent."""

    verdict: ReviewVerdict = Field(
        description="Overall review verdict: APPROVE, DENY, or NEEDS_HUMAN_REVIEW"
    )
    overall_risk_score: float = Field(
        ge=0,
        le=100,
        description="Aggregate risk score 0-100",
    )
    summary: str = Field(
        description="2-3 sentence summary of the review findings",
    )
    violated_sections: list[str] = Field(
        default_factory=list,
        description="Specific policy sections violated, if any",
    )
    dimensions: list[DimensionAssessment] = Field(
        description="Per-dimension risk assessments",
    )
    recommended_action: str = Field(
        description="Specific recommended action for human reviewer",
    )


class UsageInfo(Schema):
    """Token usage and cost from the AI call."""

    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float | None = None


class AgentReviewResult(Schema):
    """Complete result from running the review agent."""

    report: ReviewAgentReport
    data_snapshot: DataSnapshot
    model_used: str
    duration_seconds: float
    usage: UsageInfo = Field(default_factory=UsageInfo)
    timed_out: bool = False
    error: str | None = None
