from datetime import datetime, timedelta
from enum import StrEnum

from pydantic import UUID4

from polar.auth.scope import RESERVED_SCOPES, Scope
from polar.kit.schemas import Schema, TimestampedSchema
from polar.organization.schemas import OrganizationID

AvailableScope = StrEnum(  # type: ignore
    "AvailableScope", {s: s.value for s in Scope if s not in RESERVED_SCOPES}
)


class OrganizationAccessTokenCreate(Schema):
    organization_id: UUID4 | None = None
    comment: str
    expires_in: timedelta | None = None
    scopes: list[AvailableScope]  # pyright: ignore


class OrganizationAccessTokenUpdate(Schema):
    comment: str | None = None
    scopes: list[AvailableScope] | None = None  # pyright: ignore


class OrganizationAccessToken(TimestampedSchema):
    id: UUID4
    scopes: list[Scope]
    expires_at: datetime | None
    comment: str
    last_used_at: datetime | None
    organization_id: OrganizationID


class OrganizationAccessTokenCreateResponse(Schema):
    organization_access_token: OrganizationAccessToken
    token: str
