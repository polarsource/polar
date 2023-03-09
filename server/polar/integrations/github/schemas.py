from typing import Literal
from polar.kit.schemas import Schema


class BadgeAmount(Schema):
    currency: str
    amount: float


class GithubBadgeRead(Schema):
    badge_type: Literal["funding"]
    amount: BadgeAmount | None = None
