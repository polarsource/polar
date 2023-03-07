from __future__ import annotations

from datetime import datetime

from polar.integrations.github import client as github
from polar.kit.schemas import Schema
from polar.models.organization import Organization
from polar.enums import Platforms
from polar.repository.schemas import RepositoryRead


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
            # TODO: Better support for GitHub Enterprise
            is_personal = False
            name = None
            avatar_url = None
            is_site_admin = False

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


class OrganizationRead(Base):
    id: str
    # TODO: Different schema for unauthenticated requests? If we introduce them
    status: Organization.Status
    created_at: datetime
    modified_at: datetime | None

    repositories: list[RepositoryRead] | None

    class Config:
        orm_mode = True
