from datetime import datetime, timedelta
from enum import StrEnum

from pydantic import UUID4

from polar.auth.scope import RESERVED_SCOPES, Scope
from polar.kit.schemas import Schema, TimestampedSchema

AvailableScope = StrEnum(  # type: ignore
    "AvailableScope", {s: s.value for s in Scope if s not in RESERVED_SCOPES}
)


class PersonalAccessTokenCreate(Schema):
    comment: str
    expires_in: timedelta | None = None
    scopes: list[AvailableScope]  # pyright: ignore


class PersonalAccessToken(TimestampedSchema):
    id: UUID4
    scopes: list[Scope]
    expires_at: datetime | None
    comment: str
    last_used_at: datetime | None


class PersonalAccessTokenCreateResponse(Schema):
    personal_access_token: PersonalAccessToken
    token: str
