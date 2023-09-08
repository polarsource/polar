from pydantic import UUID4, EmailStr

from polar.kit.schemas import Schema


class MagicLinkRequest(Schema):
    email: EmailStr


class MagicLinkCreate(Schema):
    token_hash: str
    user_email: EmailStr
    user_id: UUID4 | None = None


class MagicLinkUpdate(Schema):
    pass
