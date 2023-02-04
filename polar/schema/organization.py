from __future__ import annotations

from datetime import datetime
from typing import Any

from polar.models.organization import Organization
from polar.platforms import Platforms
from polar.schema.account import AccountSchema
from polar.schema.base import Schema


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


class CreateOrganization(Base):
    ...


class UpdateOrganization(CreateOrganization):
    ...


class OrganizationSchema(Base):
    id: str
    # TODO: Different schema for unauthenticated requests? If we introduce them
    account: AccountSchema | None = None
    status: Organization.Status
    created_at: datetime
    modified_at: datetime | None

    class Config:
        orm_mode = True
