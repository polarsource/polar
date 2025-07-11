from pydantic import field_validator

from polar.kit.email import EmailStrDNS
from polar.kit.http import get_safe_return_url
from polar.kit.schemas import Schema
from polar.user.schemas import UserSignupAttribution


class LoginCodeRequest(Schema):
    email: EmailStrDNS
    return_to: str | None = None
    attribution: UserSignupAttribution | None = None

    @field_validator("return_to")
    @classmethod
    def validate_return_to(cls, v: str | None) -> str:
        return get_safe_return_url(v)


class LoginCodeAuthenticate(Schema):
    code: str