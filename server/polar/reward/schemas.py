from __future__ import annotations

from uuid import UUID
from datetime import datetime
from decimal import Decimal
from enum import Enum

from polar.kit.schemas import Schema


class State(str, Enum):
    initiated = "initiated"  # Initiated by customer. Polar has not received money yet.
    created = "created"  # Polar has received the money.
    pending = "pending"  # The issue has been closed, but the reward has not been paid.
    paid = "paid"  # The reward has been paid out to the maintainer.

    # Alpha flow: created -> pending -> paid
    # In the future, we might have a "disputed", "refunded", "cancelled" states etc...


class RewardCreate(Schema):
    issue_id: UUID
    amount: Decimal


class RewardUpdate(Schema):
    amount: Decimal


class RewardRead(RewardCreate):
    id: UUID
    created_at: datetime

    repository_id: UUID
    organization_id: UUID

    state: State

    client_secret: str | None

    class Config:
        orm_mode = True
