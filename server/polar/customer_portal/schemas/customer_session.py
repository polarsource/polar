from pydantic import UUID4

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import Schema


class CustomerSessionCodeRequest(Schema):
    email: EmailStrDNS
    organization_id: UUID4


class CustomerSessionCodeAuthenticateRequest(Schema):
    code: str


class CustomerSessionCodeAuthenticateResponse(Schema):
    token: str
