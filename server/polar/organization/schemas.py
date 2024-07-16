from collections.abc import Sequence
from enum import StrEnum
from typing import Annotated, Self
from uuid import UUID

from pydantic import UUID4, Field, HttpUrl

from polar.config import settings
from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.kit.schemas import (
    EmptyStrToNoneValidator,
    MergeJSONSchema,
    Schema,
    SelectorWidget,
)
from polar.models.organization import Organization as OrganizationModel

OrganizationID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The organization ID."}),
    SelectorWidget("/v1/organizations", "Organization", "name"),
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
    platform: Platforms
    name: str
    avatar_url: str
    is_personal: bool

    bio: str | None = Field(None, description="Public field from GitHub")
    pretty_name: str | None = Field(None, description="Public field from GitHub")
    company: str | None = Field(None, description="Public field from GitHub")
    blog: str | None = Field(None, description="Public field from GitHub")
    location: str | None = Field(None, description="Public field from GitHub")
    email: str | None = Field(None, description="Public field from GitHub")
    twitter_username: str | None = Field(None, description="Public field from GitHub")

    pledge_minimum_amount: int
    pledge_badge_show_amount: bool

    default_upfront_split_to_contributors: int | None = None

    account_id: UUID4 | None = None

    has_app_installed: bool = Field(
        description="Whether the organization has the Polar GitHub App installed for repositories or not."
    )

    public_page_enabled: bool = Field(
        description="If this organization has a public Polar page"
    )

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

    # Team fields
    billing_email: str | None = Field(
        None,
        description="Where to send emails about payments for pledegs that this organization/team has made. Only visible for members of the organization",
    )
    total_monthly_spending_limit: int | None = Field(
        None,
        description="Overall team monthly spending limit, per calendar month. Only visible for members of the organization",
    )
    per_user_monthly_spending_limit: int | None = Field(
        None,
        description="Team members monthly spending limit, per calendar month. Only visible for members of the organization",
    )
    is_teams_enabled: bool = Field(
        description="Feature flag for if this organization is a team."
    )

    @classmethod
    def from_db(
        cls,
        o: OrganizationModel,
        include_member_fields: bool = False,
    ) -> Self:
        profile_settings = OrganizationProfileSettings.model_validate(
            o.profile_settings
        )
        feature_settings = OrganizationFeatureSettings.model_validate(
            o.feature_settings
        )

        public_page_enabled = bool(
            o.installation_id or o.created_from_user_maintainer_upgrade
        )
        if o.blocked_at is not None:
            public_page_enabled = False

        return cls(
            id=o.id,
            platform=o.platform,
            name=o.name,
            avatar_url=o.avatar_url,
            is_personal=o.is_personal,
            bio=o.bio,
            pretty_name=o.pretty_name,
            company=o.company,
            blog=o.blog,
            location=o.location,
            email=o.email,
            twitter_username=o.twitter_username,
            pledge_minimum_amount=o.pledge_minimum_amount,
            pledge_badge_show_amount=o.pledge_badge_show_amount,
            default_upfront_split_to_contributors=o.default_upfront_split_to_contributors,
            account_id=o.account_id,
            has_app_installed=o.installation_id is not None,
            public_page_enabled=public_page_enabled,
            donations_enabled=o.donations_enabled,
            public_donation_timestamps=o.public_donation_timestamps,
            profile_settings=profile_settings,
            feature_settings=feature_settings,
            #
            billing_email=o.billing_email if include_member_fields else None,
            #
            total_monthly_spending_limit=(
                o.total_monthly_spending_limit if include_member_fields else None
            ),
            #
            per_user_monthly_spending_limit=(
                o.per_user_monthly_spending_limit if include_member_fields else None
            ),
            is_teams_enabled=o.is_teams_enabled,
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
