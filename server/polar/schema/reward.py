from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from polar.schema.issue import Base


class CreateReward(Base):
    issue_id: str
    amount: Decimal


class UpdateReward(CreateReward):
    ...


class RewardSchema(CreateReward):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True
