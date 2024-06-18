from datetime import datetime, timedelta
from enum import StrEnum

from pydantic import UUID4, Field

from polar.auth.scope import RESERVED_SCOPES, Scope
from polar.kit.schemas import Schema, TimestampedSchema

AvailableScope = StrEnum(  # type: ignore
    "AvailableScope", {s: s.value for s in Scope if s not in RESERVED_SCOPES}
)


class PersonalAccessTokenCreate(Schema):
    comment: str
    expires_in: timedelta = Field(
        default=timedelta(days=30), le=timedelta(days=365).total_seconds()
    )
    scopes: list[AvailableScope]  # pyright: ignore


class PersonalAccessToken(TimestampedSchema):
    id: UUID4
    scopes: list[Scope]
    expires_at: datetime
    comment: str
    last_used_at: datetime | None = None


class PersonalAccessTokenCreateResponse(Schema):
    personal_access_token: PersonalAccessToken
    token: str
