import datetime

from polar.kit.schemas import Schema


class CustomDomainForwardResponse(Schema):
    token: str


class CustomDomainExchangeRequest(Schema):
    token: str


class CustomDomainExchangeResponse(Schema):
    token: str
    expires_at: datetime.datetime
