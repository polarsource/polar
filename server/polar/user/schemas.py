import uuid
from typing import Any, Self

from pydantic import EmailStr, Field

from polar.enums import Platforms
from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.user import User as UserModel


# Public API
class User(Schema):
    username: str
    avatar_url: str

    @classmethod
    def from_db(cls, o: UserModel) -> Self:
        return cls(
            username=o.username,
            # TODO: remove the nullability in the db?
            avatar_url=o.avatar_url or "",
        )


# Private APIs below
class UserBase(Schema):
    username: str = Field(..., max_length=50)
    email: EmailStr
    avatar_url: str | None
    profile: dict[str, Any]

    class Config:
        orm_mode = True


class OAuthAccountRead(TimestampedSchema):
    platform: Platforms
    account_id: str
    account_email: str

    class Config:
        orm_mode = True


class UserRead(UserBase, TimestampedSchema):
    id: uuid.UUID
    accepted_terms_of_service: bool
    email_newsletters_and_changelogs: bool
    email_promotions_and_events: bool
    oauth_accounts: list[OAuthAccountRead]


# TODO: remove
class UserCreate(UserBase):
    ...


# TODO: remove
class UserUpdate(UserBase):
    ...


class UserUpdateSettings(Schema):
    email_newsletters_and_changelogs: bool | None = None
    email_promotions_and_events: bool | None = None
