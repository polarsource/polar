import datetime
from typing import Literal

from pydantic import UUID4, EmailStr, validator

from polar.kit.http import get_safe_return_url
from polar.kit.schemas import Schema

MagicLinkSource = Literal["user_login", "article_links"]


class MagicLinkRequest(Schema):
    email: EmailStr
    return_to: str | None = None

    @validator("return_to")
    def validate_return_to(cls, v: str | None) -> str:
        return get_safe_return_url(v)


class MagicLinkCreate(Schema):
    token_hash: str
    user_email: EmailStr
    user_id: UUID4 | None = None
    source: MagicLinkSource
    expires_at: datetime.datetime | None = None


class MagicLinkUpdate(Schema):
    pass
