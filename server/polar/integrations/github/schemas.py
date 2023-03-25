from typing import Literal
from polar.kit.schemas import Schema


class AuthorizationResponse(Schema):
    authorization_url: str


class CallbackRequest(Schema):
    code: str
    state: str


class OAuthAccessToken(Schema):
    access_token: str
    expires_in: int
    expires_at: int
    refresh_token: str
    refresh_token_expires_in: int


class BadgeAmount(Schema):
    currency: str
    amount: float


class GithubBadgeRead(Schema):
    badge_type: Literal["funding"]
    width: int = 445
    height: int = 44
    amount: BadgeAmount | None = None
