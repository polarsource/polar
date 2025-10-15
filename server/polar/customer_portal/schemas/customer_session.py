from datetime import datetime

from pydantic import UUID4

from polar.customer_portal.service.customer_session import (
    CustomerSessionCodeInvalidOrExpired,
)
from polar.kit.email import EmailStrDNS
from polar.kit.schemas import Schema


class CustomerSessionCodeRequest(Schema):
    email: EmailStrDNS
    organization_id: UUID4


class CustomerSessionCodeAuthenticateRequest(Schema):
    code: str


class CustomerSessionCodeAuthenticateResponse(Schema):
    token: str


CustomerSessionCodeInvalidOrExpiredResponse = {
    "description": "Invalid or expired verification code.",
    "model": CustomerSessionCodeInvalidOrExpired.schema(),
}


class CustomerCustomerSession(Schema):
    expires_at: datetime
    return_url: str | None
