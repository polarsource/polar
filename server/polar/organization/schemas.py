from __future__ import annotations

from uuid import UUID
from datetime import datetime

from polar.integrations.github import client as github
from polar.kit.schemas import Schema
from polar.models.organization import Organization
from polar.enums import Platforms
from polar.repository.schemas import RepositoryRead


class OrganizationSettingsRead(Schema):
    funding_badge_retroactive: bool = False
    funding_badge_show_amount: bool = False
    email_notification_issue_receives_backing: bool = False
    email_notification_backed_issue_branch_created: bool = False
    email_notification_backed_issue_pull_request_created: bool = False
    email_notification_backed_issue_pull_request_merged: bool = False


class OrganizationSettingsUpdate(Schema):
    funding_badge_retroactive: bool | None = None
    funding_badge_show_amount: bool | None = None
    email_notification_issue_receives_backing: bool | None = None
    email_notification_backed_issue_branch_created: bool | None = None
    email_notification_backed_issue_pull_request_created: bool | None = None
    email_notification_backed_issue_pull_request_merged: bool | None = None


class Base(Schema):
    platform: Platforms
    name: str
    external_id: int
    avatar_url: str
    is_personal: bool
    is_site_admin: bool
    installation_id: int
    installation_created_at: datetime
    installation_updated_at: datetime | None
    installation_suspended_at: datetime | None
    onboarded_at: datetime | None = None


class OrganizationCreate(Base):
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
            is_site_admin = account.site_admin
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
            is_site_admin=is_site_admin,
            installation_id=installation.id,
            installation_created_at=installation.created_at,
            installation_updated_at=installation.updated_at,
            installation_suspended_at=installation.suspended_at,
        )


class OrganizationUpdate(OrganizationCreate):
    ...


class OrganizationRead(Base, OrganizationSettingsRead):
    id: UUID
    # TODO: Different schema for unauthenticated requests? If we introduce them
    status: Organization.Status
    created_at: datetime
    modified_at: datetime | None

    repositories: list[RepositoryRead] | None

    class Config:
        orm_mode = True
