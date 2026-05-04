import re
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal
from urllib.parse import urlparse

from pydantic import (
    UUID4,
    AfterValidator,
    BeforeValidator,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)
from pydantic.json_schema import SkipJsonSchema
from pydantic.networks import HttpUrl

from polar.config import settings
from polar.enums import SubscriptionProrationBehavior, TaxBehaviorOption
from polar.kit.address import CountryAlpha2, CountryAlpha2Input
from polar.kit.currency import PresentmentCurrency
from polar.kit.email import EmailStrDNS
from polar.kit.schemas import (
    ORGANIZATION_ID_EXAMPLE,
    HttpUrlToStr,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SelectorWidget,
    SlugValidator,
    TimestampedSchema,
)
from polar.models.organization import (
    OrganizationCustomerEmailSettings,
    OrganizationCustomerPortalSettings,
    OrganizationNotificationSettings,
    OrganizationStatus,
    OrganizationSubscriptionSettings,
)
from polar.models.organization_review import OrganizationReview

OrganizationID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The organization ID."}),
    SelectorWidget("/v1/organizations", "Organization", "name"),
    Field(examples=[ORGANIZATION_ID_EXAMPLE]),
]


def validate_blocked_words(value: str) -> str:
    pattern = re.compile(
        r"\b("
        + "|".join(re.escape(w) for w in settings.ORGANIZATION_BLOCKED_WORDS)
        + r")\b",
        re.IGNORECASE,
    )
    if pattern.search(value):
        raise ValueError("This name is not allowed.")
    return value


NameInput = Annotated[
    str,
    StringConstraints(min_length=3),
    AfterValidator(validate_blocked_words),
]


def validate_reserved_keywords(value: str) -> str:
    if value in settings.ORGANIZATION_SLUG_RESERVED_KEYWORDS:
        raise ValueError("This slug is reserved.")
    return value


SlugInput = Annotated[
    str,
    StringConstraints(to_lower=True, min_length=3),
    SlugValidator,
    AfterValidator(validate_reserved_keywords),
    AfterValidator(validate_blocked_words),
]


def _discard_logo_dev_url(url: HttpUrl) -> HttpUrl | None:
    if url.host and url.host.endswith("logo.dev"):
        return None
    return url


AvatarUrl = Annotated[HttpUrlToStr, AfterValidator(_discard_logo_dev_url)]


class OrganizationCapabilities(Schema):
    checkout_payments: bool = Field(
        description="Whether the organization can accept new checkout payments."
    )
    subscription_renewals: bool = Field(
        description="Whether the organization can process subscription renewals."
    )
    payouts: bool = Field(
        description="Whether the organization can withdraw its balance."
    )
    refunds: bool = Field(description="Whether the organization can issue refunds.")
    api_access: bool = Field(description="Whether the organization can access the API.")
    dashboard_access: bool = Field(
        description="Whether the organization can access the dashboard."
    )


class OrganizationFeatureSettings(Schema):
    issue_funding_enabled: bool = Field(
        False, description="If this organization has issue funding enabled"
    )
    seat_based_pricing_enabled: bool = Field(
        False, description="If this organization has seat-based pricing enabled"
    )
    wallets_enabled: bool = Field(
        False, description="If this organization has Wallets enabled"
    )
    member_model_enabled: bool = Field(
        False, description="If this organization has the Member model enabled"
    )
    checkout_localization_enabled: bool = Field(
        False,
        description="If this organization has checkout localization enabled",
    )
    overview_metrics: list[str] | None = Field(
        None,
        description="Ordered list of metric slugs shown on the dashboard overview.",
    )
    reset_proration_behavior_enabled: bool = Field(
        False,
        description="If this organization has access to reset proration behavior.",
    )

    @field_validator("overview_metrics", mode="before")
    @classmethod
    def _coerce_overview_metrics(cls, v: Any) -> list[str] | None:
        if isinstance(v, bool):
            return None
        return v


class OrganizationDetails(Schema):
    about: str | None = Field(
        None,
        deprecated=True,
        description="Brief information about you and your business.",
    )
    product_description: str | None = Field(
        None, description="Description of digital products being sold."
    )
    selling_categories: list[str] = Field(
        default_factory=list, description="Categories of products being sold."
    )
    pricing_models: list[str] = Field(
        default_factory=list, description="Pricing models used by the organization."
    )
    intended_use: str | None = Field(
        None,
        deprecated=True,
        description="How the organization will integrate and use Polar.",
    )
    customer_acquisition: list[str] = Field(
        default_factory=list,
        deprecated=True,
        description="Main customer acquisition channels.",
    )
    future_annual_revenue: int | None = Field(
        None,
        ge=0,
        deprecated=True,
        description="Estimated revenue in the next 12 months",
    )
    switching: bool = Field(False, description="Switching from another platform?")
    switching_from: (
        Literal["paddle", "lemon_squeezy", "gumroad", "stripe", "other"] | None
    ) = Field(None, description="Which platform the organization is migrating from.")
    previous_annual_revenue: int | None = Field(
        None,
        ge=0,
        deprecated=True,
        description="Revenue from last year if applicable.",
    )


class OrganizationSocialPlatforms(StrEnum):
    x = "x"
    github = "github"
    facebook = "facebook"
    instagram = "instagram"
    youtube = "youtube"
    tiktok = "tiktok"
    linkedin = "linkedin"
    threads = "threads"
    discord = "discord"
    other = "other"


PLATFORM_DOMAINS = {
    "x": ["twitter.com", "x.com"],
    "github": ["github.com"],
    "facebook": ["facebook.com", "fb.com"],
    "instagram": ["instagram.com"],
    "youtube": ["youtube.com", "youtu.be"],
    "tiktok": ["tiktok.com"],
    "linkedin": ["linkedin.com"],
    "threads": ["threads.net"],
    "discord": ["discord.gg", "discord.com"],
}

# Reverse mapping: domain -> platform for auto-detection
DOMAIN_TO_PLATFORM: dict[str, str] = {}
for _platform, _domains in PLATFORM_DOMAINS.items():
    for _domain in _domains:
        DOMAIN_TO_PLATFORM[_domain] = _platform


def detect_platform_from_url(url: str) -> str | None:
    """Detect the social platform from a URL's hostname."""
    try:
        parsed = urlparse(url.lower())
        hostname = parsed.hostname or ""
        # Strip www. prefix
        if hostname.startswith("www."):
            hostname = hostname[4:]
        return DOMAIN_TO_PLATFORM.get(hostname)
    except Exception:
        return None


class OrganizationSocialLink(Schema):
    platform: OrganizationSocialPlatforms = Field(
        ..., description="The social platform of the URL"
    )
    url: HttpUrlToStr = Field(..., description="The URL to the organization profile")

    @model_validator(mode="before")
    @classmethod
    def validate_url(cls, data: dict[str, Any]) -> dict[str, Any]:
        url = data.get("url", "").lower()
        if not url:
            return data

        # Auto-detect platform from URL domain, fallback to "other"
        detected = detect_platform_from_url(url)
        data["platform"] = detected or "other"

        return data


class OrganizationBase(IDSchema, TimestampedSchema):
    name: str = Field(
        description="Organization name shown in checkout, customer portal, emails etc.",
    )
    slug: str = Field(
        description="Unique organization slug in checkout, customer portal and credit card statements.",
    )
    avatar_url: str | None = Field(
        description="Avatar URL shown in checkout, customer portal, emails etc."
    )
    proration_behavior: SubscriptionProrationBehavior = Field(
        description="Proration behavior applied when customer updates their subscription from the portal.",
    )
    allow_customer_updates: bool = Field(
        description="Whether customers can update their subscriptions from the customer portal.",
    )

    # Deprecated attributes
    bio: SkipJsonSchema[str | None] = Field(..., deprecated="")
    company: SkipJsonSchema[str | None] = Field(
        ...,
        deprecated="Legacy attribute no longer in use.",
    )
    blog: SkipJsonSchema[str | None] = Field(
        ...,
        deprecated="Legacy attribute no longer in use. See `socials` instead.",
    )
    location: SkipJsonSchema[str | None] = Field(
        ...,
        deprecated="Legacy attribute no longer in use.",
    )
    twitter_username: SkipJsonSchema[str | None] = Field(
        ...,
        deprecated="Legacy attribute no longer in use. See `socials` instead.",
    )

    pledge_minimum_amount: SkipJsonSchema[int] = Field(0, deprecated=True)
    pledge_badge_show_amount: SkipJsonSchema[bool] = Field(False, deprecated=True)
    default_upfront_split_to_contributors: SkipJsonSchema[int | None] = Field(
        None, deprecated=True
    )


class LegacyOrganizationStatus(StrEnum):
    """
    Legacy organization status values kept for backward compatibility in schemas
    using OrganizationPublicBase.
    """

    CREATED = "created"
    UNDER_REVIEW = "under_review"
    DENIED = "denied"
    ACTIVE = "active"

    @classmethod
    def from_status(cls, status: OrganizationStatus) -> "LegacyOrganizationStatus":
        mapping = {
            OrganizationStatus.CREATED: LegacyOrganizationStatus.CREATED,
            OrganizationStatus.REVIEW: LegacyOrganizationStatus.UNDER_REVIEW,
            OrganizationStatus.SNOOZED: LegacyOrganizationStatus.UNDER_REVIEW,
            OrganizationStatus.DENIED: LegacyOrganizationStatus.DENIED,
            OrganizationStatus.ACTIVE: LegacyOrganizationStatus.ACTIVE,
            OrganizationStatus.BLOCKED: LegacyOrganizationStatus.DENIED,
            OrganizationStatus.OFFBOARDING: LegacyOrganizationStatus.ACTIVE,
        }
        try:
            return mapping[status]
        except KeyError as e:
            raise ValueError("Unknown OrganizationStatus") from e


class OrganizationPublicBase(OrganizationBase):
    # Attributes that we used to have publicly, but now want to hide from
    # the public schema.
    # Keep it for now for backward compatibility in the SDK
    email: SkipJsonSchema[str | None]
    website: SkipJsonSchema[str | None]
    socials: SkipJsonSchema[list[OrganizationSocialLink]]
    status: Annotated[
        SkipJsonSchema[LegacyOrganizationStatus],
        BeforeValidator(LegacyOrganizationStatus.from_status),
    ]
    details_submitted_at: SkipJsonSchema[datetime | None]

    feature_settings: SkipJsonSchema[OrganizationFeatureSettings | None]
    subscription_settings: SkipJsonSchema[OrganizationSubscriptionSettings]
    notification_settings: SkipJsonSchema[OrganizationNotificationSettings]
    customer_email_settings: SkipJsonSchema[OrganizationCustomerEmailSettings]


class Organization(OrganizationBase):
    email: str | None = Field(description="Public support email.")
    website: str | None = Field(description="Official website of the organization.")
    socials: list[OrganizationSocialLink] = Field(
        description="Links to social profiles.",
    )
    status: OrganizationStatus = Field(description="Current organization status")
    details_submitted_at: datetime | None = Field(
        description="When the business details were submitted for review.",
    )

    default_presentment_currency: str = Field(
        description=(
            "Default presentment currency. "
            "Used as fallback in checkout and customer portal, "
            "if the customer's local currency is not available."
        )
    )
    default_tax_behavior: TaxBehaviorOption = Field(
        description="Default tax behavior applied on products."
    )
    feature_settings: OrganizationFeatureSettings | None = Field(
        description="Organization feature settings",
    )
    subscription_settings: OrganizationSubscriptionSettings = Field(
        description="Settings related to subscriptions management",
    )
    notification_settings: OrganizationNotificationSettings = Field(
        description="Settings related to notifications",
    )
    customer_email_settings: OrganizationCustomerEmailSettings = Field(
        description="Settings related to customer emails",
    )
    customer_portal_settings: OrganizationCustomerPortalSettings = Field(
        description="Settings related to the customer portal",
    )
    country: CountryAlpha2 | None = Field(
        None, description="Two-letter country code (ISO 3166-1 alpha-2)."
    )

    account_id: UUID4 | None = Field(description="ID of the transactions account.")
    payout_account_id: UUID4 | None = Field(description="ID of the payout account.")

    capabilities: OrganizationCapabilities = Field(
        description="Capabilities currently granted to the organization.",
    )


class OrganizationKYC(Organization):
    """Organization with compliance/KYC details. Only returned from the dedicated KYC endpoint."""

    details: OrganizationDetails | None = Field(
        None,
        description="Organization compliance details. Only visible to organization members.",
    )


class OrganizationIndividualLegalEntitySchema(Schema):
    type: Literal["individual"]


class OrganizationCompanyLegalEntitySchema(Schema):
    type: Literal["company"]
    registered_name: str


OrganizationLegalEntitySchema = Annotated[
    OrganizationIndividualLegalEntitySchema | OrganizationCompanyLegalEntitySchema,
    Field(discriminator="type"),
]


class OrganizationCreate(Schema):
    name: NameInput
    slug: SlugInput
    avatar_url: AvatarUrl | None = None
    legal_entity: OrganizationLegalEntitySchema | None = None
    email: EmailStrDNS | None = Field(None, description="Public support email.")
    website: HttpUrlToStr | None = Field(
        None, description="Official website of the organization."
    )
    socials: list[OrganizationSocialLink] | None = Field(
        None,
        description="Link to social profiles.",
    )
    details: OrganizationDetails | None = Field(
        None,
        description="Additional, private, business details Polar needs about active organizations for compliance (KYC).",
    )
    country: CountryAlpha2Input | None = Field(
        None, description="Two-letter country code (ISO 3166-1 alpha-2)."
    )
    feature_settings: OrganizationFeatureSettings | None = None
    subscription_settings: OrganizationSubscriptionSettings | None = None
    notification_settings: OrganizationNotificationSettings | None = None
    customer_email_settings: OrganizationCustomerEmailSettings | None = None
    customer_portal_settings: OrganizationCustomerPortalSettings | None = None
    default_presentment_currency: PresentmentCurrency = Field(
        PresentmentCurrency.usd,
        description="Default presentment currency for the organization",
    )
    default_tax_behavior: TaxBehaviorOption = Field(
        default=TaxBehaviorOption.location,
        description="Default tax behavior applied on products.",
    )


class OrganizationUpdate(Schema):
    name: NameInput | None = None
    avatar_url: AvatarUrl | None = None

    email: EmailStrDNS | None = Field(None, description="Public support email.")
    website: HttpUrlToStr | None = Field(
        None, description="Official website of the organization."
    )
    socials: list[OrganizationSocialLink] | None = Field(
        None, description="Links to social profiles."
    )
    details: OrganizationDetails | None = Field(
        None,
        description="Additional, private, business details Polar needs about active organizations for compliance (KYC).",
    )
    country: CountryAlpha2Input | None = Field(
        None, description="Two-letter country code (ISO 3166-1 alpha-2)."
    )

    feature_settings: OrganizationFeatureSettings | None = None
    subscription_settings: OrganizationSubscriptionSettings | None = None
    notification_settings: OrganizationNotificationSettings | None = None
    customer_email_settings: OrganizationCustomerEmailSettings | None = None
    customer_portal_settings: OrganizationCustomerPortalSettings | None = None
    default_presentment_currency: PresentmentCurrency | None = Field(
        None, description="Default presentment currency for the organization"
    )
    default_tax_behavior: TaxBehaviorOption | None = Field(
        None, description="Default tax behavior applied on products."
    )


class OrganizationReviewSubmissionDetails(Schema):
    product_description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=30)
    ]


def _empty_review_submission_details_to_dict(value: Any) -> Any:
    if value is None:
        return {}
    return value


class OrganizationReviewSubmission(Schema):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    website: Annotated[str, StringConstraints(min_length=1)]
    email: EmailStrDNS
    socials: list[OrganizationSocialLink] = Field(min_length=1)
    details: Annotated[
        OrganizationReviewSubmissionDetails,
        BeforeValidator(_empty_review_submission_details_to_dict),
    ]


class OrganizationReviewSubmissionBody(Schema):
    body: OrganizationReviewSubmission


class OrganizationPaymentStatus(Schema):
    payment_ready: bool = Field(
        description="Whether the organization is ready to accept payments"
    )
    organization_status: OrganizationStatus = Field(
        description="Current organization status"
    )


class OrganizationAppealRequest(Schema):
    reason: Annotated[
        str,
        StringConstraints(min_length=50, max_length=5000),
        Field(
            description="Detailed explanation of why this organization should be approved. Minimum 50 characters."
        ),
    ]


class OrganizationAppealResponse(Schema):
    success: bool = Field(description="Whether the appeal was successfully submitted")
    message: str = Field(description="Success or error message")
    appeal_submitted_at: datetime = Field(description="When the appeal was submitted")


class OrganizationReviewStatus(Schema):
    verdict: Literal["PASS", "FAIL", "UNCERTAIN"] | None = Field(
        default=None, description="AI validation verdict"
    )
    reason: str | None = Field(default=None, description="Reason for the verdict")
    appeal_submitted_at: datetime | None = Field(
        default=None, description="When appeal was submitted"
    )
    appeal_reason: str | None = Field(default=None, description="Reason for the appeal")
    appeal_decision: OrganizationReview.AppealDecision | None = Field(
        default=None, description="Decision on the appeal (approved/rejected)"
    )
    appeal_reviewed_at: datetime | None = Field(
        default=None, description="When appeal was reviewed"
    )


class OrganizationReviewCheckKey(StrEnum):
    """Stable identifiers for each check. Adding a new key is a coordinated FE+BE change."""

    IDENTITY_EMAIL = "identity.email"
    IDENTITY_SOCIAL_LINKS = "identity.social_links"
    IDENTITY_STRIPE_VERIFICATION = "identity.stripe_identity_verification"
    PRODUCT_DESCRIPTION = "product_description"
    PAYOUT_ACCOUNT = "payout_account"


class OrganizationReviewCheckStatus(StrEnum):
    PASSED = "passed"
    WARNING = "warning"  # attention flag; does NOT block submission
    FAILED = "failed"
    PENDING = "pending"


class OrganizationReviewCheckReason(StrEnum):
    """Reasons explaining a check's status. Scoped reasons are namespaced
    with the prefix of the check key they apply to."""

    # Universal
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    EXTERNAL_PENDING = "external_pending"

    # Identity
    IDENTITY_REJECTED = "identity.rejected"
    IDENTITY_PERSONAL_EMAIL = "identity.personal_email"
    IDENTITY_DOMAIN_MISMATCH = "identity.domain_mismatch"

    # Payout account
    PAYOUT_ACCOUNT_REQUIREMENTS_DUE = "payout_account.requirements_due"
    PAYOUT_ACCOUNT_PAYOUTS_DISABLED = "payout_account.payouts_disabled"


class OrganizationReviewCheck(Schema):
    """A single item in the self-review checklist."""

    key: OrganizationReviewCheckKey
    status: OrganizationReviewCheckStatus
    reasons: list[OrganizationReviewCheckReason] = Field(
        default_factory=list,
        description="Reasons for the current status. Empty when `passed`.",
    )


class OrganizationReviewAppeal(Schema):
    submitted_at: datetime
    reviewed_at: datetime | None = None
    decision: OrganizationReview.AppealDecision | None = None


OrganizationReviewVerdict = Literal["pass", "fail"]


class OrganizationReviewState(Schema):
    """Merchant self-review checklist. Frozen once `submitted_at` is set."""

    can_submit: bool = Field(
        description=(
            "True when `submitted_at` is null AND no preliminary check is "
            "`failed` or `pending`. Warnings do not block submission."
        )
    )
    submitted_at: datetime | None = None
    verdict: OrganizationReviewVerdict | None = None
    appeal: OrganizationReviewAppeal | None = None
    preliminary_steps: list[OrganizationReviewCheck] = Field(default_factory=list)


class OrganizationDeletionBlockedReason(StrEnum):
    """Reasons why an organization cannot be immediately deleted."""

    HAS_ORDERS = "has_orders"
    HAS_ACTIVE_SUBSCRIPTIONS = "has_active_subscriptions"
    STRIPE_ACCOUNT_DELETION_FAILED = "stripe_account_deletion_failed"


class OrganizationDeletionResponse(Schema):
    """Response for organization deletion request."""

    deleted: bool = Field(
        description="Whether the organization was immediately deleted"
    )
    requires_support: bool = Field(
        description="Whether a support ticket was created for manual handling"
    )
    blocked_reasons: list[OrganizationDeletionBlockedReason] = Field(
        default_factory=list,
        description="Reasons why immediate deletion is blocked",
    )


class OrganizationValidateWebsiteRequest(Schema):
    url: HttpUrl = Field(description="The URL to validate.")


class OrganizationValidateWebsiteResponse(Schema):
    reachable: bool = Field(description="Whether the URL is reachable.")
    status: int | None = Field(
        default=None, description="HTTP status code returned by the URL."
    )
    error: str | None = Field(
        default=None, description="Error message if the URL is not reachable."
    )


class OrganizationPayoutAccountSet(Schema):
    payout_account_id: UUID4 = Field(
        description="ID of the payout account to set on the organization."
    )
