from typing import Literal
from uuid import UUID
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


class GithubIssueDependency(Schema):
    raw: str
    owner: str | None = None
    repo: str | None = None
    number: int

    @property
    def canonical(self) -> str:
        if self.owner and self.repo:
            return f"{self.owner.lower()}/{self.repo.lower()}#{self.number}"
        else:
            return f"#{self.number}"
