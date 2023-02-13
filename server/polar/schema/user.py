import uuid
from typing import Any

from fastapi_users import schemas
from pydantic import BaseModel

from polar.schema.organization import OrganizationSchema


class UserBase(BaseModel):
    profile: dict[str, Any]
    organizations: list[OrganizationSchema] | None


class UserRead(schemas.BaseUser[uuid.UUID], UserBase):
    ...


class UserCreate(schemas.BaseUserCreate, UserBase):
    ...


class UserUpdate(schemas.BaseUserUpdate, UserBase):
    ...
