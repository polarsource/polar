from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from pydantic import Field, computed_field

from polar.enums import PayoutAccountType
from polar.kit.schemas import Schema

if TYPE_CHECKING:
    from pydantic_ai.usage import RunUsage as Usage

# --- Review enums ---


class ActorType(StrEnum):
    AGENT = "agent"
    HUMAN = "human"


class DecisionType(StrEnum):
    APPROVE = "APPROVE"
    DENY = "DENY"
    ESCALATE = "ESCALATE"
    SNOOZE = "SNOOZE"


class AUPSection(StrEnum):
    """Acceptable Use Policy "Prohibited Products" sections, plus a catch-all `other`.

    Keys are stable descriptive codes with no reference to the policy's section
    numbering. Display numbering and ordering live in `AUP_SECTION_LABELS`,
    which can be freely updated as the policy document evolves.
    """

    PHYSICAL_PRODUCTS = "physical_products"
    HUMAN_SERVICES = "human_services"
    DONATIONS_CROWDFUNDING_COMMUNITY_ADVERTISING_SPONSORSHIP = (
        "donations_crowdfunding_community_advertising_sponsorship"
    )
    MARKETPLACES = "marketplaces"
    INTELLECTUAL_PROPERTY_INFRINGEMENT = "intellectual_property_infringement"
    UNAUTHORIZED_DATA_ACCESS = "unauthorized_data_access"
    NON_POLAR_SELLERS = "non_polar_sellers"
    ADVERTISING_UNSOLICITED_MARKETING = "advertising_unsolicited_marketing"
    ADULT_CONTENT = "adult_content"
    MINORS = "minors"
    GAMBLING_BETTING = "gambling_betting"
    ILLEGAL_AGE_RESTRICTED = "illegal_age_restricted"
    RESELLING_CUSTOMER_DATA = "reselling_customer_data"
    LOW_QUALITY_COUNTERFEIT = "low_quality_counterfeit"
    FAKE_TESTIMONIALS_REVIEWS = "fake_testimonials_reviews"
    REGULATED = "regulated"
    RESELLING_SOFTWARE_LICENSES = "reselling_software_licenses"
    CIRCUMVENTION = "circumvention"
    TRADING_FINANCIAL = "trading_financial"
    GET_RICH_SCHEMES = "get_rich_schemes"
    GOVERNMENT_SERVICES = "government_services"
    CHEATING = "cheating"
    JOB_BOARDS = "job_boards"
    TRAVEL_SERVICES = "travel_services"
    IPTV = "iptv"
    VIRUSES_SPYWARE = "viruses_spyware"
    API_IP_CLOAKING = "api_ip_cloaking"
    TRADEMARK_REMOVAL = "trademark_removal"
    TELECOM_ESIM = "telecom_esim"
    CONTENT_DOWNLOADERS = "content_downloaders"
    PSEUDO_SCIENCE = "pseudo_science"
    MEDICAL_HEALTH_ADVICE = "medical_health_advice"
    CONTENT_GENERATION_INFRINGING = "content_generation_infringing"
    TECH_SUPPORT_REPAIR = "tech_support_repair"
    TEST_PREP_PLATFORMS = "test_prep_platforms"
    OSINT = "osint"
    OTHER = "other"


AUP_SECTION_LABELS: dict[AUPSection, str] = {
    AUPSection.PHYSICAL_PRODUCTS: "1. Physical products",
    AUPSection.HUMAN_SERVICES: "2. Human services",
    AUPSection.DONATIONS_CROWDFUNDING_COMMUNITY_ADVERTISING_SPONSORSHIP: (
        "3. Donations, crowdfunding, community access, advertising, and sponsorship"
    ),
    AUPSection.MARKETPLACES: (
        "4. Marketplaces. Selling others' products or services using Polar against an "
        "upfront payment or with an agreed upon revenue share"
    ),
    AUPSection.INTELLECTUAL_PROPERTY_INFRINGEMENT: (
        "5. Any product or service that infringes upon, or enables the infringement of, "
        "the intellectual property rights of another party or that you do not own or do "
        "not have a license to"
    ),
    AUPSection.UNAUTHORIZED_DATA_ACCESS: (
        "6. Any product or service that enables unauthorized access to data belonging to "
        "another party"
    ),
    AUPSection.NON_POLAR_SELLERS: (
        "7. Any product or service that enables non-Polar Sellers to sell products and "
        "services to customers"
    ),
    AUPSection.ADVERTISING_UNSOLICITED_MARKETING: (
        "8. Advertising and unsolicited marketing services, including, but not limited "
        "to, lead generation, bulk SMS and automated outreach"
    ),
    AUPSection.ADULT_CONTENT: (
        "9. Adult content and services including, but not limited to, OnlyFans-related "
        "and similar services, adult AI-generated content and AI relationship services"
    ),
    AUPSection.MINORS: (
        "10. Services used by, intended for, or advertised towards minors"
    ),
    AUPSection.GAMBLING_BETTING: (
        "11. Gambling and betting services, including, but not limited to loot boxes and "
        "mystery boxes"
    ),
    AUPSection.ILLEGAL_AGE_RESTRICTED: (
        "12. Illegal or age-restricted products, including, but not limited to, drugs, "
        "alcohol, tobacco and vaping"
    ),
    AUPSection.RESELLING_CUSTOMER_DATA: "13. Reselling or distributing customer data",
    AUPSection.LOW_QUALITY_COUNTERFEIT: (
        "14. Low-quality or counterfeit products or services"
    ),
    AUPSection.FAKE_TESTIMONIALS_REVIEWS: (
        "15. Fake testimonials, reviews, social proof, and review inflation platforms"
    ),
    AUPSection.REGULATED: "16. Regulated services or products",
    AUPSection.RESELLING_SOFTWARE_LICENSES: (
        "17. Reselling software licenses without authorization"
    ),
    AUPSection.CIRCUMVENTION: (
        "18. Services to circumvent the rules, paywalls or terms of other services"
    ),
    AUPSection.TRADING_FINANCIAL: (
        "19. Trading and Financial Services (transactions/investments, trading "
        "bots/brokerage/advisory, financial advice, NFTs and Crypto)"
    ),
    AUPSection.GET_RICH_SCHEMES: '20. "Get Rich" schemes or content',
    AUPSection.GOVERNMENT_SERVICES: "21. Government Services",
    AUPSection.CHEATING: (
        "22. Cheating, including but not limited to macros, cheat codes and hacks"
    ),
    AUPSection.JOB_BOARDS: "23. Job boards",
    AUPSection.TRAVEL_SERVICES: "24. Travel Services",
    AUPSection.IPTV: (
        "25. IPTV services, including software or platforms that enable IPTV service "
        "delivery"
    ),
    AUPSection.VIRUSES_SPYWARE: "26. Viruses and Spyware",
    AUPSection.API_IP_CLOAKING: "27. API and IP cloaking services",
    AUPSection.TRADEMARK_REMOVAL: "28. Third-party trademark removal services",
    AUPSection.TELECOM_ESIM: "29. Telecommunication and eSIM Services",
    AUPSection.CONTENT_DOWNLOADERS: (
        "30. Third-party content downloaders (YouTube, Instagram, Snapchat, …)"
    ),
    AUPSection.PSEUDO_SCIENCE: (
        "31. Digital services associated with pseudo-science (clairvoyance, horoscopes, "
        "fortune-telling)"
    ),
    AUPSection.MEDICAL_HEALTH_ADVICE: "32. Medical and Health advice",
    AUPSection.CONTENT_GENERATION_INFRINGING: (
        "33. Content generation infringing trademarks/copyrights, face swaps/deep fakes, "
        "or adult content"
    ),
    AUPSection.TECH_SUPPORT_REPAIR: "34. Technical support and repair services",
    AUPSection.TEST_PREP_PLATFORMS: (
        "35. Standardized test prep platforms reselling real/past exam questions (IELTS, "
        "SAT, GMAT)"
    ),
    AUPSection.OSINT: (
        "36. Open Source Intelligence (OSINT) platforms aggregating/exposing personal "
        "data"
    ),
    AUPSection.OTHER: "Other",
}


class ReviewContext(StrEnum):
    SUBMISSION = "submission"  # First review at details submission time
    SETUP_COMPLETE = "setup_complete"  # Review when account setup is complete
    THRESHOLD = "threshold"  # Following reviews when payment threshold hit
    MANUAL = "manual"  # Full manual review triggered from backoffice
    APPEAL = "appeal"  # Appeal of a previous denial
    PRODUCT_CHANGED = (
        "product_changed"  # Review when an active org creates/updates a product
    )


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
    def from_agent_usage(cls, usage: Usage, provider: str, model: str) -> UsageInfo:
        import genai_prices

        estimated_cost: float | None = None
        try:
            price = genai_prices.calc_price(usage, model, provider_id=provider)
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
    id: str | None = None
    name: str
    slug: str
    website: str | None = None
    email: str | None = None
    about: str | None = None
    product_description: str | None = None
    selling_categories: list[str] = Field(default_factory=list)
    pricing_models: list[str] = Field(default_factory=list)
    switching_from: str | None = None
    previous_annual_revenue: int | None = None
    socials: list[dict[str, str]] = Field(default_factory=list)
    created_at: datetime | None = None
    details_submitted_at: datetime | None = None
    is_blocked: bool = False


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
    adhoc_prices_count: int = Field(
        default=0,
        description=(
            "Number of prices created on-demand at checkout via the API, overriding "
            "the catalog price for that checkout."
        ),
    )
    custom_pricing_products_count: int = Field(
        default=0,
        description=(
            "Number of active products with pay-what-you-want pricing (the customer "
            "enters the amount at checkout)."
        ),
    )


class IdentityData(Schema):
    verification_status: str | None = None
    verification_error_code: str | None = None
    verified_first_name: str | None = None
    verified_last_name: str | None = None
    verified_address_country: str | None = None
    verified_dob: str | None = None


class PayoutAccountData(Schema):
    type: PayoutAccountType | None = None
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
    is_blocked: bool = False


class HistoryData(Schema):
    user_email: str | None = None
    user_blocked_at: datetime | None = None
    prior_organizations: list[PriorOrganization] = Field(default_factory=list)
    has_prior_denials: bool = False
    has_blocked_orgs: bool = False


class UrlRedirectInfo(Schema):
    """Tracks where a URL ultimately redirects to."""

    original_url: str
    final_url: str | None = None
    final_domain: str | None = None
    redirected: bool = False
    error: str | None = None


class CheckoutSuccessUrlData(Schema):
    unique_urls: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    redirect_results: list[UrlRedirectInfo] = Field(default_factory=list)


class CheckoutReturnUrlData(Schema):
    unique_urls: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    redirect_results: list[UrlRedirectInfo] = Field(default_factory=list)


class CheckoutLinkBenefitData(Schema):
    label: str | None = None
    product_names: list[str] = Field(default_factory=list)
    has_benefits: bool = False


class CheckoutLinksData(Schema):
    total_links: int = 0
    links_without_benefits: int = 0
    links: list[CheckoutLinkBenefitData] = Field(default_factory=list)


class WebhookEndpointData(Schema):
    url: str
    enabled: bool = True


class IntegrationData(Schema):
    api_key_count: int = 0
    webhook_endpoints: list[WebhookEndpointData] = Field(default_factory=list)
    webhook_domains: list[str] = Field(default_factory=list)
    webhook_known_service_domains: list[str] = Field(default_factory=list)


class SetupData(Schema):
    checkout_success_urls: CheckoutSuccessUrlData = Field(
        default_factory=CheckoutSuccessUrlData
    )
    checkout_return_urls: CheckoutReturnUrlData = Field(
        default_factory=CheckoutReturnUrlData
    )
    checkout_links: CheckoutLinksData = Field(default_factory=CheckoutLinksData)
    integration: IntegrationData = Field(default_factory=IntegrationData)
    webhook_host: WebsiteData | None = Field(
        default=None,
        description=(
            "Summary of the public site served on the webhook endpoint's host, "
            "when it differs from the declared website host and is not on the "
            "known-integration-platform whitelist. None when the webhook host "
            "matches the declared host, is a known service, or no webhooks exist."
        ),
    )


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
    usage: UsageInfo = Field(default_factory=UsageInfo)


class PriorDimensionAssessment(Schema):
    """Summary of a single dimension from a prior agent review."""

    dimension: str = Field(description="e.g. policy_compliance, product_legitimacy")
    risk_level: str = Field(description="LOW, MEDIUM, or HIGH")
    findings: list[str] = Field(default_factory=list)


class PriorFeedbackEntry(Schema):
    """A single prior review decision for the organization."""

    actor_type: str = Field(
        description="Who made this decision: 'agent' (automated) or 'human' (backoffice reviewer)"
    )
    decision: str = Field(
        description="Action taken by the actor: 'APPROVE', 'DENY', or 'ESCALATE'"
    )
    review_context: str = Field(
        description="Review trigger: submission, setup_complete, threshold, manual, appeal"
    )
    reason: str | None = Field(
        default=None,
        description="Human-provided reason (always None for agent entries)",
    )
    agent_verdict: str | None = Field(
        default=None,
        description="The AI agent's raw verdict: 'APPROVE' or 'DENY'. "
        "Present on both agent and human entries when an agent review exists.",
    )
    agent_risk_level: str | None = Field(
        default=None,
        description="Agent's overall risk level: 'LOW', 'MEDIUM', or 'HIGH'",
    )
    agent_report_summary: str | None = Field(
        default=None, description="Summary from the linked agent review report"
    )
    violated_sections: list[str] = Field(
        default_factory=list,
        description="Policy sections the agent flagged as violated",
    )
    dimensions: list[PriorDimensionAssessment] = Field(
        default_factory=list,
        description="Per-dimension risk assessments from the agent review",
    )
    created_at: datetime | None = None


class PriorFeedbackData(Schema):
    """All prior review decisions for the organization."""

    entries: list[PriorFeedbackEntry] = Field(default_factory=list)


class RiskSignalEntry(Schema):
    """A single external risk signal recorded against the organization."""

    source: str = Field(description="Where the signal came from, e.g. 'stripe'")
    type: str = Field(
        description="Signal type, e.g. fraudulent_website or fraudulent_merchant"
    )
    risk_level: str = Field(
        description="Severity reported by the source, e.g. 'elevated' or 'highest'"
    )
    description: str | None = None
    created_at: datetime | None = None


class RiskSignalData(Schema):
    """External risk signals recorded against the organization."""

    entries: list[RiskSignalEntry] = Field(default_factory=list)


class DataSnapshot(Schema):
    """All collected data for the AI analyzer."""

    context: ReviewContext | None = None
    organization: OrganizationData
    products: ProductsData
    identity: IdentityData = Field(default_factory=IdentityData)
    account: PayoutAccountData
    metrics: PaymentMetrics
    history: HistoryData
    setup: SetupData = Field(default_factory=SetupData)
    website: WebsiteData | None = None
    prior_feedback: PriorFeedbackData = Field(default_factory=PriorFeedbackData)
    risk_signals: RiskSignalData = Field(default_factory=RiskSignalData)
    appeal_reason: str | None = None
    original_denial_reason: str | None = None
    collected_at: datetime


# --- AI Analyzer output schemas ---


class ReviewDimension(StrEnum):
    POLICY_COMPLIANCE = "policy_compliance"
    PRODUCT_LEGITIMACY = "product_legitimacy"
    IDENTITY_TRUST = "identity_trust"
    FINANCIAL_RISK = "financial_risk"
    PRIOR_HISTORY = "prior_history"
    SETUP_READINESS = "setup_readiness"


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


RISK_LEVEL_SCORES: dict[RiskLevel, float] = {
    RiskLevel.LOW: 15.0,
    RiskLevel.MEDIUM: 50.0,
    RiskLevel.HIGH: 85.0,
}


class DimensionAssessment(Schema):
    dimension: ReviewDimension = Field(
        description="The review dimension being assessed"
    )
    risk_level: RiskLevel = Field(
        description="Risk level: LOW (no/minimal risk), MEDIUM (some concerns, needs attention), HIGH (serious risk, likely violation)"
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

    @computed_field  # type: ignore[prop-decorator]
    @property
    def score(self) -> float:
        """Backward compat: derived numeric score so old code can read new data."""
        return RISK_LEVEL_SCORES[self.risk_level]


class ReviewVerdict(StrEnum):
    APPROVE = "APPROVE"
    DENY = "DENY"
    NEEDS_HUMAN_REVIEW = "NEEDS_HUMAN_REVIEW"


class ReviewAgentReport(Schema):
    """Structured output from the AI review agent."""

    verdict: ReviewVerdict = Field(
        description="Overall review verdict: APPROVE or DENY"
    )
    summary: str = Field(
        description="1-2 sentence summary of the review findings for internal reviewers",
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
    overall_risk_level: RiskLevel = Field(
        description="Overall risk level across all dimensions: LOW, MEDIUM, or HIGH"
    )
    recommended_action: str = Field(
        description="Specific recommended action for human reviewer",
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def overall_risk_score(self) -> float:
        """Backward compat: numeric score from overall_risk_level."""
        return RISK_LEVEL_SCORES[self.overall_risk_level]


class AgentReviewResult(Schema):
    """Complete result from running the review agent."""

    report: ReviewAgentReport
    data_snapshot: DataSnapshot
    model_used: str
    model_provider: str
    duration_seconds: float
    usage: UsageInfo = Field(default_factory=UsageInfo)
    timed_out: bool = False
    error: str | None = None
