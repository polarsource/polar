from collections.abc import Sequence
from enum import StrEnum
from typing import Annotated, Self

from pydantic import (
    UUID4,
    AfterValidator,
    Field,
    HttpUrl,
    StringConstraints,
    model_validator,
)
from slugify import slugify

from polar.config import settings
from polar.currency.schemas import CurrencyAmount
from polar.kit.schemas import (
    EmptyStrToNoneValidator,
    HttpUrlToStr,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SelectorWidget,
    TimestampedSchema,
)

OrganizationID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The organization ID."}),
    SelectorWidget("/v1/organizations", "Organization", "name"),
]


class OrganizationFeatureSettings(Schema):
    articles_enabled: bool = Field(
        False, description="If this organization has articles enabled"
    )
    issue_funding_enabled: bool = Field(
        False, description="If this organization has issue funding enabled"
    )


class OrganizationSubscribePromoteSettings(Schema):
    promote: bool = Field(True, description="Promote email subscription (free)")
    show_count: bool = Field(True, description="Show subscription count publicly")
    count_free: bool = Field(
        True, description="Include free subscribers in total count"
    )


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
    name: str
    slug: str
    avatar_url: str | None

    bio: str | None
    company: str | None
    blog: str | None
    location: str | None
    email: str | None
    twitter_username: str | None

    pledge_minimum_amount: int
    pledge_badge_show_amount: bool

    default_upfront_split_to_contributors: int | None

    donations_enabled: bool = Field(
        description="If this organizations accepts donations"
    )

    profile_settings: OrganizationProfileSettings | None = Field(
        description="Settings for the organization profile"
    )

    feature_settings: OrganizationFeatureSettings | None = Field(
        description="Settings for the organization features"
    )


def validate_slug(value: str) -> str:
    slugified = slugify(value)
    if slugified != value:
        raise ValueError(
            "The slug can only contain ASCII letters, numbers and hyphens."
        )
    return value


def validate_reserved_keywords(value: str) -> str:
    if value in settings.ORGANIZATION_SLUG_RESERVED_KEYWORDS:
        raise ValueError("This slug is reserved.")
    return value


class OrganizationCreate(Schema):
    name: Annotated[str, StringConstraints(min_length=3)]
    slug: Annotated[
        str,
        StringConstraints(to_lower=True, min_length=3),
        AfterValidator(validate_slug),
        AfterValidator(validate_reserved_keywords),
    ]
    avatar_url: HttpUrlToStr | None = None
    donations_enabled: bool = False
    feature_settings: OrganizationFeatureSettings | None = None


class OrganizationUpdate(Schema):
    name: Annotated[
        str | None, StringConstraints(min_length=3), EmptyStrToNoneValidator
    ] = None
    avatar_url: HttpUrlToStr | None = None

    default_upfront_split_to_contributors: int | None = Field(
        default=None, ge=0.0, le=100.0
    )

    pledge_badge_show_amount: bool = False
    billing_email: str | None = None

    default_badge_custom_content: str | None = None

    pledge_minimum_amount: int = settings.MINIMUM_ORG_PLEDGE_AMOUNT

    total_monthly_spending_limit: int | None = None

    per_user_monthly_spending_limit: int | None = None

    donations_enabled: bool = False

    profile_settings: OrganizationProfileSettings | None = None
    feature_settings: OrganizationFeatureSettings | None = None

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


class OrganizationCustomerType(StrEnum):
    free_subscription = "free_subscription"
    paid_subscription = "paid_subscription"
    order = "order"
    donation = "donation"


class OrganizationCustomer(Schema):
    public_name: str
    github_username: str | None
    avatar_url: str | None


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
