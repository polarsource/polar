from __future__ import annotations

from datetime import datetime
from typing import Sequence
from uuid import UUID

from pydantic import BaseModel

from polar.config import settings
from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.kit.schemas import Schema


# Public model
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

    class Config:
        orm_mode = True


#
# Internal models below. Not to be used in "public" APIs!
#


# Internal model
class OrganizationSettingsRead(BaseModel):
    pledge_badge_show_amount: bool = True
    billing_email: str | None = None


# Internal model
class OrganizationSettingsUpdate(Schema):
    pledge_badge_show_amount: bool | None = None
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
    def from_github_installation(
        cls, installation: github.rest.Installation
    ) -> OrganizationCreate:
        account = installation.account

        if not isinstance(account, github.rest.SimpleUser):
            raise Exception("Polar does not support GitHub Enterprise")

        is_personal = account.type.lower() == "user"
        name = account.login
        avatar_url = account.avatar_url
        external_id = account.id
        if not name:
            raise Exception("repository.name is not set")
        if not avatar_url:
            raise Exception("repository.avatar_url is not set")

        return cls(
            platform=Platforms.github,
            name=name,
            external_id=external_id,
            avatar_url=avatar_url,
            is_personal=is_personal,
            installation_id=installation.id,
            installation_created_at=installation.created_at,
            installation_updated_at=installation.updated_at,
            installation_suspended_at=installation.suspended_at,
        )


# Internal model
class OrganizationUpdate(OrganizationCreate):
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
