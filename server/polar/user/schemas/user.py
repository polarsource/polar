import uuid
from typing import Self

from pydantic import UUID4, EmailStr, Field

from polar.auth.scope import Scope
from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.user import OAuthPlatform
from polar.models.user import User as UserModel


# Public API
class User(Schema):
    username: str
    avatar_url: str

    @classmethod
    def from_db(cls, o: UserModel) -> Self:
        return cls(
            username=o.username_or_email,
            # TODO: remove the nullability in the db?
            avatar_url=o.avatar_url or "",
        )


# Private APIs below
class UserBase(Schema):
    username: str = Field(..., max_length=50)
    email: EmailStr
    avatar_url: str | None = None
    account_id: UUID4 | None = None


class OAuthAccountRead(TimestampedSchema):
    platform: OAuthPlatform
    account_id: str
    account_email: str
    account_username: str | None


class UserRead(UserBase, TimestampedSchema):
    id: uuid.UUID
    accepted_terms_of_service: bool
    oauth_accounts: list[OAuthAccountRead]


# TODO: remove
class UserCreate(UserBase): ...


# TODO: remove
class UserUpdate(UserBase): ...


class UserSetAccount(Schema):
    account_id: UUID4


class UserStripePortalSession(Schema):
    url: str


class UserScopes(Schema):
    scopes: list[Scope]
