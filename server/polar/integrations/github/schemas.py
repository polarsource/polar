from typing import Literal
from polar.kit.schemas import Schema


class BadgeAmount(Schema):
    currency: str
    amount: float


class GithubBadgeRead(Schema):
    badge_type: Literal["funding"]
    width: int = 445
    height: int = 44
    amount: BadgeAmount | None = None
