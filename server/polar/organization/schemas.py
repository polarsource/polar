from __future__ import annotations

from datetime import datetime
from typing import Self, Sequence
from uuid import UUID

from pydantic import Field

from polar.config import settings
from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.kit.schemas import Schema
from polar.models.organization import Organization as OrganizationModel


# Public API
class Organization(Schema):
    id: UUID
    platform: Platforms
    name: str
    avatar_url: str

    bio: str | None
    pretty_name: str | None
    company: str | None
    blog: str | None
    location: str | None
    email: str | None
    twitter_username: str | None

    pledge_minimum_amount: int
    pledge_badge_show_amount: bool

    default_upfront_split_to_contributors: int | None

    @classmethod
    def from_db(cls, o: OrganizationModel) -> Self:
        return cls(
            id=o.id,
            platform=o.platform,
            name=o.name,
            avatar_url=o.avatar_url,
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
        )


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
# TODO: Remove
class OrganizationSettingsRead(Schema):
    pledge_badge_show_amount: bool = True
    billing_email: str | None = None


# Internal model
class OrganizationPrivateBase(Schema):
    platform: Platforms
    name: str
    avatar_url: str
    external_id: int
    is_personal: bool
    installation_id: int | None = None
    installation_created_at: datetime | None = None
    installation_updated_at: datetime | None = None
    installation_suspended_at: datetime | None = None
    onboarded_at: datetime | None = None
    pledge_minimum_amount: int
    default_badge_custom_content: str | None = None


# Private model
class OrganizationCreate(OrganizationPrivateBase):
    pledge_minimum_amount: int = settings.MINIMUM_ORG_PLEDGE_AMOUNT

    @classmethod
    def from_github(
        cls,
        user: github.webhooks.User | github.rest.SimpleUser,
        *,
        installation: github.webhooks.Installation
        | github.rest.Installation
        | None = None,
    ) -> Self:
        if installation is None:
            return cls(
                platform=Platforms.github,
                name=user.login,
                external_id=user.id,
                avatar_url=user.avatar_url,
                is_personal=user.type.lower() == "user",
            )

        installation_created_at = (
            datetime.fromtimestamp(installation.created_at)
            if isinstance(installation.created_at, int)
            else installation.created_at
        )
        installation_updated_at = (
            datetime.fromtimestamp(installation.updated_at)
            if isinstance(installation.updated_at, int)
            else installation.updated_at
        )
        return cls(
            platform=Platforms.github,
            name=user.login,
            external_id=user.id,
            avatar_url=user.avatar_url,
            is_personal=user.type.lower() == "user",
            installation_id=installation.id,
            installation_created_at=installation_created_at,
            installation_updated_at=installation_updated_at,
            installation_suspended_at=installation.suspended_at,
        )


# Internal model
class OrganizationGitHubUpdate(OrganizationCreate):
    ...


# Internal model
class RepositoryBadgeSettingsUpdate(Schema):
    id: UUID
    badge_auto_embed: bool
    retroactive: bool


# Internal model
class RepositoryBadgeSettingsRead(Schema):
    id: UUID
    avatar_url: str | None
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
    message: str | None
    repositories: Sequence[RepositoryBadgeSettingsRead]


# Internal model
class OrganizationSyncedRepositoryRead(Schema):
    id: UUID
    synced_issues_count: int


# Internal model
class OrganizationSyncedRead(Schema):
    repos: list[OrganizationSyncedRepositoryRead]
