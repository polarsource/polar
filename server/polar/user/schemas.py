import uuid
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from polar.kit.schemas import Schema


class UserBase(Schema):
    username: str = Field(..., max_length=50)
    email: EmailStr
    avatar_url: str | None
    profile: dict[str, Any]
    invite_only_approved: bool

    class Config:
        orm_mode = True


class UserRead(UserBase):
    id: uuid.UUID


class UserCreate(UserBase):
    ...


class UserUpdate(UserBase):
    ...
