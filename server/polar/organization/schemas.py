from collections.abc import Sequence
from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import UUID4, Field

from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.integrations.github import types
from polar.kit.schemas import Schema
from polar.models.organization import Organization as OrganizationModel

ORGANIZATION_DESCRIPTION_MAX_LENGTH = 160


class OrganizationProfileSettings(Schema):
    description: str | None = Field(
        None,
        description="A description of the organization",
        max_length=ORGANIZATION_DESCRIPTION_MAX_LENGTH,
    )
    featured_projects: list[UUID4] | None = Field(
        None, description="A list of featured projects"
    )
    featured_organizations: list[UUID4] | None = Field(
        None, description="A list of featured organizations"
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

    custom_domain: str | None = None

    profile_settings: OrganizationProfileSettings | None = Field(
        description="Settings for the organization profile"
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
        profile_settings = OrganizationProfileSettings(
            description=o.profile_settings.get("description", None),
            featured_projects=o.profile_settings.get("featured_projects", None),
            featured_organizations=o.profile_settings.get(
                "featured_organizations", None
            ),
        )

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
            custom_domain=o.custom_domain,
            profile_settings=profile_settings,
            #
            billing_email=o.billing_email if include_member_fields else None,
            #
            total_monthly_spending_limit=o.total_monthly_spending_limit
            if include_member_fields
            else None,
            #
            per_user_monthly_spending_limit=o.per_user_monthly_spending_limit
            if include_member_fields
            else None,
            is_teams_enabled=o.is_teams_enabled,
        )


class OrganizationProfileSettingsUpdate(Schema):
    set_description: bool | None = None
    description: str | None = None

    featured_projects: list[UUID4] | None = None
    featured_organizations: list[UUID4] | None = None


class OrganizationUpdate(Schema):
    set_default_upfront_split_to_contributors: bool | None = None
    default_upfront_split_to_contributors: int | None = Field(
        default=None, ge=0.0, le=100.0
    )

    pledge_badge_show_amount: bool | None = None
    billing_email: str | None = None

    set_default_badge_custom_content: bool | None = None
    default_badge_custom_content: str | None = None

    pledge_minimum_amount: int | None = None

    set_total_monthly_spending_limit: bool | None = None
    total_monthly_spending_limit: int | None = None

    set_per_user_monthly_spending_limit: bool | None = None
    per_user_monthly_spending_limit: int | None = None

    profile_settings: OrganizationProfileSettingsUpdate | None = None


class OrganizationSetAccount(Schema):
    account_id: UUID4


class OrganizationStripePortalSession(Schema):
    url: str


class CreditBalance(Schema):
    amount: CurrencyAmount = Field(
        description="The customers credit balance. A negative value means that Polar owes this customer money (credit), a positive number means that the customer owes Polar money (debit)."
    )


#
# Internal models below. Not to be used in "public" APIs!
#


# Internal model
class OrganizationCreateFromGitHubInstallation(Schema):
    platform: Platforms
    name: str
    avatar_url: str
    external_id: int
    is_personal: bool
    installation_id: int
    installation_created_at: datetime
    installation_updated_at: datetime
    installation_suspended_at: datetime | None = None
    installation_permissions: types.AppPermissionsType

    @classmethod
    def from_github(
        cls,
        *,
        user: types.SimpleUser,
        installation: types.Installation,
    ) -> Self:
        return cls(
            platform=Platforms.github,
            name=user.login,
            external_id=user.id,
            avatar_url=user.avatar_url,
            is_personal=user.type.lower() == "user",
            installation_id=installation.id,
            installation_created_at=installation.created_at,
            installation_updated_at=installation.updated_at,
            installation_suspended_at=installation.suspended_at,
            installation_permissions=types.app_permissions_from_github(
                installation.permissions
            ),
        )


# Internal model
class OrganizationCreateFromGitHubUser(Schema):
    platform: Platforms
    name: str
    avatar_url: str
    external_id: int
    is_personal: bool

    @classmethod
    def from_github(
        cls,
        *,
        user: types.SimpleUser,
    ) -> Self:
        return cls(
            platform=Platforms.github,
            name=user.login,
            external_id=user.id,
            avatar_url=user.avatar_url,
            is_personal=user.type.lower() == "user",
        )


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
