from enum import Enum

from polar.kit.schemas import Schema
from polar.organization.schemas import Organization
from polar.pledge.schemas import Pledge
from polar.user.schemas import User


class RewardState(str, Enum):
    pending = "pending"
    paid = "paid"
    # refund = "refund"
    # disputed = "disputed"


# class Transaction(Schema):
#     # issue_id: UUID
#     # email: str | None = None
#     amount: int
#     pledge: Pledge | None  # ???
#     user: User | None
#     # pledge_as_org: UUID | None = None


class Reward(Schema):
    pledge: Pledge
    user: User | None
    organization: Organization | None
    amount: int
    state: RewardState
