import uuid
from typing import Any

from pydantic import EmailStr, Field

from polar.kit.schemas import Schema


class UserBase(Schema):
    username: str = Field(..., max_length=50)
    email: EmailStr
    avatar_url: str | None
    profile: dict[str, Any]

    class Config:
        orm_mode = True


class UserRead(UserBase):
    id: uuid.UUID
    invite_only_approved: bool
    accepted_terms_of_service: bool
    email_newsletters_and_changelogs: bool
    email_promotions_and_events: bool


# TODO: remove
class UserCreate(UserBase):
    ...


# TODO: remove
class UserUpdate(UserBase):
    ...


class UserUpdateSettings(Schema):
    email_newsletters_and_changelogs: bool | None = None
    email_promotions_and_events: bool | None = None
