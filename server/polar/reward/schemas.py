from datetime import datetime
from enum import Enum

from pydantic import Field

from polar.currency.schemas import CurrencyAmount
from polar.kit.schemas import Schema
from polar.organization.schemas import Organization
from polar.pledge.schemas import Pledge
from polar.user.schemas import User


class RewardState(str, Enum):
    # The reward is still pending, this might mean that the user haven't claimed the
    # reward yet, or that a payment method is missing, or that the payment has not
    # yet been processed.
    pending = "pending"
    # The reward has been paid out to the user or organization.
    paid = "paid"


class Reward(Schema):
    pledge: Pledge = Field(description="The pledge that the reward was split from")
    user: User | None = Field(
        None, description="The user that received the reward (if any)"
    )
    organization: Organization | None = Field(
        None, description="The organization that received the reward (if any)"
    )
    amount: CurrencyAmount
    state: RewardState
    paid_at: datetime | None = Field(
        None, description="If and when the reward was paid out."
    )


class RewardsSummaryReceiver(Schema):
    name: str
    avatar_url: str | None = None


class RewardsSummary(Schema):
    receivers: list[RewardsSummaryReceiver]
