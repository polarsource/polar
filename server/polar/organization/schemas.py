from collections.abc import Sequence
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal, Self

from pydantic import (
    UUID4,
    AfterValidator,
    EmailStr,
    Field,
    HttpUrl,
    StringConstraints,
    model_validator,
)

from polar.config import settings
from polar.currency.schemas import CurrencyAmount
from polar.kit.schemas import (
    ORGANIZATION_ID_EXAMPLE,
    EmptyStrToNoneValidator,
    HttpUrlToStr,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SelectorWidget,
    SlugValidator,
    TimestampedSchema,
)
from polar.models.organization import OrganizationSubscriptionSettings

OrganizationID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The organization ID."}),
    SelectorWidget("/v1/organizations", "Organization", "name"),
    Field(examples=[ORGANIZATION_ID_EXAMPLE]),
]


class OrganizationFeatureSettings(Schema):
    issue_funding_enabled: bool = Field(
        False, description="If this organization has issue funding enabled"
    )


class OrganizationSubscribePromoteSettings(Schema):
    promote: bool = Field(True, description="Promote email subscription (free)")
    show_count: bool = Field(True, description="Show subscription count publicly")
    count_free: bool = Field(
        True, description="Include free subscribers in total count"
    )


class OrganizationDetails(Schema):
    about: str = Field(
        ..., description="Brief information about you and your business."
    )
    product_description: str = Field(
        ..., description="Description of digital products being sold."
    )
    intended_use: str = Field(
        ..., description="How the organization will integrate and use Polar."
    )
    customer_acquisition: list[str] = Field(
        ..., description="Main customer acquisition channels."
    )
    future_annual_revenue: int = Field(
        ..., description="Estimated revenue in the next 12 months"
    )
    switching: bool = Field(True, description="Switching from another platform?")
    switching_from: (
        Literal["paddle", "lemon_squeezy", "gumroad", "stripe", "other"] | None
    ) = Field(None, description="Which platform the organization is migrating from.")
    previous_annual_revenue: int = Field(
        0, description="Revenue from last year if applicable."
    )


class OrganizationSocialPlatforms(StrEnum):
    x = "x"
    github = "github"
    facebook = "facebook"
    instagram = "instagram"
    youtube = "youtube"
    tiktok = "tiktok"
    linkedin = "linkedin"
    other = "other"


PLATFORM_DOMAINS = {
    "x": ["twitter.com", "x.com"],
    "github": ["github.com"],
    "facebook": ["facebook.com", "fb.com"],
    "instagram": ["instagram.com"],
    "youtube": ["youtube.com", "youtu.be"],
    "tiktok": ["tiktok.com"],
    "linkedin": ["linkedin.com"],
}


class OrganizationSocialLink(Schema):
    platform: OrganizationSocialPlatforms = Field(
        ..., description="The social platform of the URL"
    )
    url: HttpUrlToStr = Field(..., description="The URL to the organization profile")

    @model_validator(mode="before")
    @classmethod
    def validate_url(cls, data: dict[str, Any]) -> dict[str, Any]:
        platform = data.get("platform")
        url = data.get("url", "").lower()

        if not (platform and url):
            return data

        if platform == "other":
            return data

        valid_domains = PLATFORM_DOMAINS[platform]
        if not any(domain in url for domain in valid_domains):
            raise ValueError(
                f"Invalid URL for {platform}. Must be from: {', '.join(valid_domains)}"
            )

        return data


# Deprecated
class OrganizationProfileSettings(Schema):
    enabled: bool | None = Field(
        None, description="If this organization has a profile enabled"
    )
    description: Annotated[
        str | None,
        Field(max_length=160, description="A description of the organization"),
        EmptyStrToNoneValidator,
    ] = None
    featured_projects: list[UUID4] | None = Field(
        None, description="A list of featured projects"
    )
    featured_organizations: list[UUID4] | None = Field(
        None, description="A list of featured organizations"
    )
    links: list[HttpUrl] | None = Field(
        None, description="A list of links associated with the organization"
    )
    subscribe: OrganizationSubscribePromoteSettings | None = Field(
        OrganizationSubscribePromoteSettings(
            promote=True,
            show_count=True,
            count_free=True,
        ),
        description="Subscription promotion settings",
    )
    accent_color: str | None = Field(
        None, description="Accent color for the organization"
    )


# Public API
class Organization(IDSchema, TimestampedSchema):
    id: OrganizationID
    name: str = Field(
        description="Organization name shown in checkout, customer portal, emails etc.",
    )
    slug: str = Field(
        description="Unique organization slug in checkout, customer portal and credit card statements.",
    )
    avatar_url: str | None = Field(
        description="Avatar URL shown in checkout, customer portal, emails etc."
    )

    email: str | None = Field(description="Public support email.")
    website: str | None = Field(description="Official website of the organization.")
    socials: list[OrganizationSocialLink] = Field(
        description="Links to social profiles.",
    )
    details_submitted_at: datetime | None = Field(
        description="When the business details were submitted.",
    )

    feature_settings: OrganizationFeatureSettings | None = Field(
        description="Organization feature settings",
    )
    subscription_settings: OrganizationSubscriptionSettings = Field(
        description="Settings related to subscriptions management",
    )

    # Deprecated attributes
    bio: str | None = Field(..., deprecated="")
    company: str | None = Field(
        ...,
        deprecated="Legacy attribute no longer in use.",
    )
    blog: str | None = Field(
        ...,
        deprecated="Legacy attribute no longer in use. See `socials` instead.",
    )
    location: str | None = Field(
        ...,
        deprecated="Legacy attribute no longer in use.",
    )
    twitter_username: str | None = Field(
        ...,
        deprecated="Legacy attribute no longer in use. See `socials` instead.",
    )
    pledge_minimum_amount: int = Field(
        ...,
        deprecated="Legacy attribute no longer in use.",
    )
    pledge_badge_show_amount: bool = Field(
        ...,
        deprecated="Legacy attribute no longer in use.",
    )
    default_upfront_split_to_contributors: int | None = Field(
        ...,
        deprecated="Legacy attribute no longer in use.",
    )
    profile_settings: OrganizationProfileSettings | None = Field(
        description="Settings for the organization profile",
        deprecated="Legacy attribute no longer in use.",
    )


def validate_reserved_keywords(value: str) -> str:
    if value in settings.ORGANIZATION_SLUG_RESERVED_KEYWORDS:
        raise ValueError("This slug is reserved.")
    return value


class OrganizationCreate(Schema):
    name: Annotated[str, StringConstraints(min_length=3)]
    slug: Annotated[
        str,
        StringConstraints(to_lower=True, min_length=3),
        SlugValidator,
        AfterValidator(validate_reserved_keywords),
    ]
    avatar_url: HttpUrlToStr | None = None
    email: EmailStr | None = Field(None, description="Public support email.")
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
    feature_settings: OrganizationFeatureSettings | None = None
    subscription_settings: OrganizationSubscriptionSettings | None = None


class OrganizationUpdate(Schema):
    name: Annotated[
        str | None, StringConstraints(min_length=3), EmptyStrToNoneValidator
    ] = None
    avatar_url: HttpUrlToStr | None = None

    email: str | None = Field(None, description="Public support email.")
    website: str | None = Field(
        None, description="Official website of the organization."
    )
    socials: list[OrganizationSocialLink] | None = Field(
        None, description="Links to social profiles."
    )
    details: OrganizationDetails | None = Field(
        None,
        description="Additional, private, business details Polar needs about active organizations for compliance (KYC).",
    )

    feature_settings: OrganizationFeatureSettings | None = None
    subscription_settings: OrganizationSubscriptionSettings | None = None

    # Deprecated fields
    default_upfront_split_to_contributors: int | None = Field(
        default=None,
        ge=0.0,
        le=100.0,
        deprecated="Legacy attribute no longer in use.",
    )
    pledge_badge_show_amount: bool = Field(
        False, deprecated="Legacy attribute no longer in use."
    )
    billing_email: str | None = Field(
        None, deprecated="Legacy attribute no longer in use."
    )
    default_badge_custom_content: str | None = Field(
        None, deprecated="Legacy attribute no longer in use."
    )
    pledge_minimum_amount: int = Field(
        settings.MINIMUM_ORG_PLEDGE_AMOUNT,
        deprecated="Legacy attribute no longer in use.",
    )
    total_monthly_spending_limit: int | None = Field(
        None, deprecated="Legacy attribute no longer in use."
    )
    per_user_monthly_spending_limit: int | None = Field(
        None, deprecated="Legacy attribute no longer in use."
    )
    profile_settings: OrganizationProfileSettings | None = Field(
        None, deprecated="Legacy attribute no longer in use."
    )

    @model_validator(mode="after")
    def check_spending_limits(self) -> Self:
        if (
            self.per_user_monthly_spending_limit is not None
            and self.total_monthly_spending_limit is None
        ):
            raise ValueError(
                "per_user_monthly_spending_limit requires "
                "total_monthly_spending_limit to be set"
            )

        if (
            self.per_user_monthly_spending_limit is not None
            and self.total_monthly_spending_limit is not None
            and self.per_user_monthly_spending_limit > self.total_monthly_spending_limit
        ):
            raise ValueError(
                "per_user_monthly_spending_limit must be less than or equal "
                "to total_monthly_spending_limit"
            )

        return self


class OrganizationSetAccount(Schema):
    account_id: UUID4


class OrganizationStripePortalSession(Schema):
    url: str


class CreditBalance(Schema):
    amount: CurrencyAmount = Field(
        description="The customers credit balance. A negative value means that Polar owes this customer money (credit), a positive number means that the customer owes Polar money (debit)."
    )


# Internal model
class RepositoryBadgeSettingsUpdate(Schema):
    id: UUID4
    badge_auto_embed: bool
    retroactive: bool


# Internal model
class RepositoryBadgeSettingsRead(Schema):
    id: UUID4
    avatar_url: str | None
    name: str
    synced_issues: int
    open_issues: int
    auto_embedded_issues: int
    label_embedded_issues: int
    badge_auto_embed: bool
    badge_label: str
    is_private: bool
    is_sync_completed: bool


# Internal model
class OrganizationBadgeSettingsUpdate(Schema):
    show_amount: bool
    minimum_amount: int
    message: str
    repositories: Sequence[RepositoryBadgeSettingsUpdate]


# Internal model
class OrganizationBadgeSettingsRead(Schema):
    show_amount: bool
    minimum_amount: int
    message: str | None
    repositories: Sequence[RepositoryBadgeSettingsRead]
