import uuid
from typing import Any

from pydantic import BaseModel, EmailStr

from polar.kit.schemas import Schema


class UserBase(Schema):
    email: EmailStr
    profile: dict[str, Any]
    hashed_password: str
    is_active: bool = True
    is_superuser: bool = False
    is_verified: bool = False

    class Config:
        orm_mode = True


class UserRead(UserBase):
    id: uuid.UUID


class UserCreate(UserBase):
    ...


class UserUpdate(UserBase):
    ...
