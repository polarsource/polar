from pydantic import UUID4

from polar.kit.schemas import EmailStrDNS, Schema


class CustomerSessionCodeRequest(Schema):
    email: EmailStrDNS
    organization_id: UUID4


class CustomerSessionCodeAuthenticateRequest(Schema):
    code: str


class CustomerSessionCodeAuthenticateResponse(Schema):
    token: str
