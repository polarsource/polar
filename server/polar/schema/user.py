import uuid
from typing import Any

from fastapi_users import schemas
from pydantic import BaseModel


class UserBase(BaseModel):
    profile: dict[str, Any]


class UserRead(schemas.BaseUser[uuid.UUID], UserBase):
    ...


class UserCreate(schemas.BaseUserCreate, UserBase):
    ...


class UserUpdate(schemas.BaseUserUpdate, UserBase):
    ...
