import datetime
from typing import Literal

from pydantic import UUID4, EmailStr

from polar.kit.schemas import Schema

MagicLinkSource = Literal["user_login", "article_links"]


class MagicLinkRequest(Schema):
    email: EmailStr


class MagicLinkCreate(Schema):
    token_hash: str
    user_email: EmailStr
    user_id: UUID4 | None = None
    source: MagicLinkSource
    expires_at: datetime.datetime | None = None


class MagicLinkUpdate(Schema):
    pass
