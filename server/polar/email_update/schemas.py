from pydantic import field_validator

from polar.kit.http import get_safe_return_url
from polar.kit.schemas import EmailStrDNS, Schema


class EmailUpdateRequest(Schema):
    email: EmailStrDNS
    return_to: str | None = None

    @field_validator("return_to")
    @classmethod
    def validate_return_to(cls, v: str | None) -> str:
        return get_safe_return_url(v)
