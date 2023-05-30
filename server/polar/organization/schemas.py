from __future__ import annotations

from uuid import UUID
from typing import Sequence
from datetime import datetime

from pydantic import BaseModel

from polar.integrations.github import client as github
from polar.kit.schemas import Schema
from polar.models.organization import Organization
from polar.enums import Platforms
from polar.repository.schemas import RepositoryRead


class OrganizationSettingsRead(BaseModel):
    pledge_badge_show_amount: bool = False

    email_notification_maintainer_issue_receives_backing: bool = False
    email_notification_maintainer_issue_branch_created: bool = False
    email_notification_maintainer_pull_request_created: bool = False
    email_notification_maintainer_pull_request_merged: bool = False
    email_notification_backed_issue_branch_created: bool = False
    email_notification_backed_issue_pull_request_created: bool = False
    email_notification_backed_issue_pull_request_merged: bool = False

    billing_email: str | None = None


class OrganizationSettingsUpdate(Schema):
    pledge_badge_show_amount: bool | None = None

    email_notification_maintainer_issue_receives_backing: bool | None = None
    email_notification_maintainer_issue_branch_created: bool | None = None
    email_notification_maintainer_pull_request_created: bool | None = None
    email_notification_maintainer_pull_request_merged: bool | None = None
    email_notification_backed_issue_branch_created: bool | None = None
    email_notification_backed_issue_pull_request_created: bool | None = None
    email_notification_backed_issue_pull_request_merged: bool | None = None

    billing_email: str | None = None


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


class OrganizationCreate(OrganizationPrivateBase):
    @classmethod
    def from_github_installation(
        cls, installation: github.rest.Installation
    ) -> OrganizationCreate:
        account = installation.account

        if isinstance(account, github.rest.SimpleUser):
            is_personal = account.type.lower() == "user"
            name = account.login
            avatar_url = account.avatar_url
            external_id = account.id
        else:
            raise Exception("Polar does not support GitHub Enterprise")

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


class OrganizationUpdate(OrganizationCreate):
    ...


class OrganizationPublicRead(Schema):
    id: UUID
    platform: Platforms
    name: str
    avatar_url: str

    class Config:
        orm_mode = True


class OrganizationPrivateRead(OrganizationPrivateBase, OrganizationSettingsRead):
    id: UUID

    # TODO: Different schema for unauthenticated requests? If we introduce them
    status: Organization.Status
    created_at: datetime
    modified_at: datetime | None

    repositories: list[RepositoryRead] | None

    class Config:
        orm_mode = True


class PaymentMethod(Schema):
    type: str  # example: "card"
    card_last4: str | None = None
    card_brand: str | None = None  # example: "visa"


class OrganizationStripeCustomerRead(Schema):
    email: str | None = None
    addressCity: str | None = None
    addressCountry: str | None = None
    addressLine1: str | None = None
    addressLine2: str | None = None
    postalCode: str | None = None
    state: str | None = None

    default_payment_method: PaymentMethod | None = None


class OrganizationSetupIntentRead(Schema):
    id: str
    status: str
    client_secret: str


class RepositoryBadgeSettingsUpdate(Schema):
    id: UUID
    badge_auto_embed: bool
    retroactive: bool


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


class OrganizationBadgeSettingsUpdate(Schema):
    show_amount: bool
    repositories: Sequence[RepositoryBadgeSettingsUpdate]


class OrganizationBadgeSettingsRead(Schema):
    show_amount: bool
    repositories: Sequence[RepositoryBadgeSettingsRead]


class OrganizationSyncedRepositoryRead(Schema):
    id: UUID
    synced_issues_count: int


class OrganizationSyncedRead(Schema):
    repos: list[OrganizationSyncedRepositoryRead]
