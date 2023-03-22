import uuid
from typing import Any

from fastapi_users import schemas
from pydantic import BaseModel

from polar.kit.schemas import Schema


class UserBase(BaseModel):
    profile: dict[str, Any]


class UserRead(schemas.BaseUser[uuid.UUID], UserBase):
    ...


class UserCreate(schemas.BaseUserCreate, UserBase, Schema):
    ...


class UserUpdate(schemas.BaseUserUpdate, UserBase, Schema):
    ...
