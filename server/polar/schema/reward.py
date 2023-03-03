from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum

from polar.schema.base import Schema


class State(str, Enum):
    created = "created"  # Created by the customer. Polar has received the money.
    pending = "pending"  # The issue has been closed, but the reward has not been paid.
    paid = "paid"  # The reward has been paid out to the maintainer.

    # Alpha flow: created -> pending -> paid
    # In the future, we might have a "disputed", "refunded", "cancelled" states etc...


class RewardCreate(Schema):
    issue_id: str
    amount: Decimal


class RewardUpdate(RewardCreate):
    ...


class RewardRead(RewardCreate):
    id: str
    created_at: datetime

    repository_id: str
    organization_id: str

    state: State

    class Config:
        orm_mode = True
