from enum import Enum

from polar.currency.schemas import CurrencyAmount
from polar.kit.schemas import Schema
from polar.organization.schemas import Organization
from polar.pledge.schemas import Pledge
from polar.user.schemas import User


class RewardState(str, Enum):
    pending = "pending"
    paid = "paid"


class Reward(Schema):
    pledge: Pledge
    user: User | None
    organization: Organization | None
    amount: CurrencyAmount
    state: RewardState
