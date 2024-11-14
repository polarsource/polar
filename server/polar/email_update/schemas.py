import datetime

from pydantic import field_validator
from polar.kit.http import get_safe_return_url
from polar.kit.schemas import Schema, EmailStrDNS, UUID4
from polar.user.schemas.user import UserSignupAttribution

class EmailUpdateCreate(Schema):
    email: EmailStrDNS
    token_hash: str
    expires_at: datetime.datetime | None = None
    user_id: UUID4
    
class EmailUpdateRequest(Schema):
    email: EmailStrDNS
    return_to: str | None = None
    attribution: UserSignupAttribution | None = None
    
    @field_validator("return_to")
    @classmethod
    def validate_return_to(cls, v: str | None) -> str:
        return get_safe_return_url(v)