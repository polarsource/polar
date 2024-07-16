from collections.abc import Sequence
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import UUID4, Field, HttpUrl

from polar.config import settings
from polar.currency.schemas import CurrencyAmount
from polar.kit.schemas import (
    EmptyStrToNoneValidator,
    MergeJSONSchema,
    Schema,
    SelectorWidget,
)

OrganizationID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The organization ID."}),
    SelectorWidget("/v1/organizations/", "Organization", "name"),
]


class OrganizationFeatureSettings(Schema):
    articles_enabled: bool = Field(
        False, description="If this organization has articles enabled"
    )
    subscriptions_enabled: bool = Field(
        False, description="If this organization has subscriptions enabled"
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


# Public API
class Organization(Schema):
    id: UUID
    slug: str
    avatar_url: str

    bio: str | None = None
    pretty_name: str | None = None
    company: str | None = None
    blog: str | None = None
    location: str | None = None
    email: str | None = None
    twitter_username: str | None = None

    pledge_minimum_amount: int
    pledge_badge_show_amount: bool

    default_upfront_split_to_contributors: int | None = None

    donations_enabled: bool = Field(
        description="If this organizations accepts donations"
    )

    public_donation_timestamps: bool = Field(
        description="If this organization should make donation timestamps publicly available"
    )

    profile_settings: OrganizationProfileSettings | None = Field(
        description="Settings for the organization profile"
    )

    feature_settings: OrganizationFeatureSettings | None = Field(
        description="Settings for the organization features"
    )


class OrganizationUpdate(Schema):
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
    public_donation_timestamps: bool = False

    profile_settings: OrganizationProfileSettings | None = None
    feature_settings: OrganizationFeatureSettings | None = None


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
    github_username: str | None = None
    avatar_url: str | None = None


# Internal model
class RepositoryBadgeSettingsUpdate(Schema):
    id: UUID
    badge_auto_embed: bool
    retroactive: bool


# Internal model
class RepositoryBadgeSettingsRead(Schema):
    id: UUID
    avatar_url: str | None = None
    name: str
    synced_issues: int
    open_issues: int
    auto_embedded_issues: int
    label_embedded_issues: int
    pull_requests: int
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
    message: str | None = None
    repositories: Sequence[RepositoryBadgeSettingsRead]
