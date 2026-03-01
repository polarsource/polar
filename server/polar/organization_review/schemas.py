from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from pydantic import Field

from polar.kit.schemas import Schema

if TYPE_CHECKING:
    from pydantic_ai.usage import RunUsage as Usage

# --- Review context ---


class ReviewContext(StrEnum):
    SUBMISSION = "submission"  # First review at details submission time
    SETUP_COMPLETE = "setup_complete"  # Review when all setup steps are done
    THRESHOLD = "threshold"  # Following reviews when payment threshold hit
    MANUAL = "manual"  # Full manual review triggered from backoffice


# --- Shared utility schemas ---


class UsageInfo(Schema):
    """Token usage and cost from the AI call."""

    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float | None = None

    def __add__(self, other: UsageInfo) -> UsageInfo:
        cost: float | None = None
        if self.estimated_cost_usd is not None or other.estimated_cost_usd is not None:
            cost = (self.estimated_cost_usd or 0.0) + (other.estimated_cost_usd or 0.0)
        return UsageInfo(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
            total_tokens=self.total_tokens + other.total_tokens,
            estimated_cost_usd=cost,
        )

    @classmethod
    def from_agent_usage(cls, usage: Usage, model_name: str) -> UsageInfo:
        import genai_prices

        estimated_cost: float | None = None
        try:
            price = genai_prices.calc_price(usage, model_name, provider_id="openai")
            estimated_cost = float(price.total_price)
        except Exception:
            pass
        return cls(
            input_tokens=usage.input_tokens or 0,
            output_tokens=usage.output_tokens or 0,
            total_tokens=(usage.input_tokens or 0) + (usage.output_tokens or 0),
            estimated_cost_usd=estimated_cost,
        )


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


class IdentityData(Schema):
    verification_status: str | None = None
    verification_error_code: str | None = None
    verified_first_name: str | None = None
    verified_last_name: str | None = None
    verified_address_country: str | None = None
    verified_dob: str | None = None


class AccountData(Schema):
    country: str | None = None
    currency: str | None = None
    business_type: str | None = None
    is_details_submitted: bool = False
    is_charges_enabled: bool = False
    is_payouts_enabled: bool = False

    requirements_currently_due: list[str] = Field(default_factory=list)
    requirements_past_due: list[str] = Field(default_factory=list)
    requirements_pending_verification: list[str] = Field(default_factory=list)
    requirements_disabled_reason: str | None = None
    requirements_errors: list[dict[str, str]] = Field(default_factory=list)
    capabilities: dict[str, str] = Field(default_factory=dict)
    business_name: str | None = None
    business_url: str | None = None
    business_support_address_country: str | None = None


class PaymentMetrics(Schema):
    total_payments: int = 0
    succeeded_payments: int = 0
    total_amount_cents: int = 0
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


class CheckoutSuccessUrlData(Schema):
    unique_urls: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)


class CheckoutReturnUrlData(Schema):
    unique_urls: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)


class CheckoutLinkBenefitData(Schema):
    label: str | None = None
    product_names: list[str] = Field(default_factory=list)
    has_benefits: bool = False


class CheckoutLinksData(Schema):
    total_links: int = 0
    links_without_benefits: int = 0
    links: list[CheckoutLinkBenefitData] = Field(default_factory=list)


class IntegrationData(Schema):
    api_key_count: int = 0
    webhook_urls: list[str] = Field(default_factory=list)
    webhook_domains: list[str] = Field(default_factory=list)


class SetupData(Schema):
    checkout_success_urls: CheckoutSuccessUrlData = Field(
        default_factory=CheckoutSuccessUrlData
    )
    checkout_return_urls: CheckoutReturnUrlData = Field(
        default_factory=CheckoutReturnUrlData
    )
    checkout_links: CheckoutLinksData = Field(default_factory=CheckoutLinksData)
    integration: IntegrationData = Field(default_factory=IntegrationData)


class WebsitePage(Schema):
    url: str
    title: str | None = None
    content: str = Field(default="", description="Extracted text content")
    content_truncated: bool = False
    method: str = Field(
        default="http", description="How the page was fetched: 'http' or 'browser'"
    )


class WebsiteData(Schema):
    base_url: str
    pages: list[WebsitePage] = Field(default_factory=list)
    summary: str | None = Field(
        default=None, description="AI-generated summary of website content"
    )
    scrape_error: str | None = None
    total_pages_attempted: int = 0
    total_pages_succeeded: int = 0
    usage: UsageInfo | None = Field(default_factory=UsageInfo)


class PriorFeedbackEntry(Schema):
    """A single prior review decision for the organization."""

    actor_type: str = Field(description="'agent' or 'human'")
    decision: str = Field(description="'APPROVE', 'DENY', or 'ESCALATE'")
    review_context: str = Field(
        description="Review trigger: submission, setup_complete, threshold, manual, appeal"
    )
    verdict: str | None = None
    risk_score: float | None = None
    reason: str | None = Field(
        default=None, description="Human-provided reason for the decision"
    )
    agent_summary: str | None = Field(
        default=None, description="Summary from the linked agent review"
    )
    created_at: datetime | None = None


class PriorFeedbackData(Schema):
    """All prior review decisions for the organization."""

    entries: list[PriorFeedbackEntry] = Field(default_factory=list)


class DataSnapshot(Schema):
    """All collected data for the AI analyzer."""

    context: ReviewContext
    organization: OrganizationData
    products: ProductsData
    identity: IdentityData
    account: AccountData
    metrics: PaymentMetrics
    history: HistoryData
    setup: SetupData = Field(default_factory=SetupData)
    website: WebsiteData | None = None
    prior_feedback: PriorFeedbackData = Field(default_factory=PriorFeedbackData)
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


class ReviewAgentReport(Schema):
    """Structured output from the AI review agent."""

    verdict: ReviewVerdict = Field(
        description="Overall review verdict: APPROVE or DENY"
    )
    overall_risk_score: float = Field(
        ge=0,
        le=100,
        description="Aggregate risk score 0-100",
    )
    summary: str = Field(
        description="2-3 sentence summary of the review findings for internal reviewers",
    )
    merchant_summary: str = Field(
        default="",
        description=(
            "1-2 sentence reason shown to the merchant. "
            "Must NOT mention: scraped website content, prior organizations, "
            "internal risk scores, or Stripe verification specifics. "
        ),
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


class AgentReviewResult(Schema):
    """Complete result from running the review agent."""

    report: ReviewAgentReport
    data_snapshot: DataSnapshot
    model_used: str
    duration_seconds: float
    usage: UsageInfo = Field(default_factory=UsageInfo)
    timed_out: bool = False
    error: str | None = None
