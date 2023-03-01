from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from polar.schema.base import Schema


class CreateReward(Schema):
    issue_id: str
    amount: Decimal


class UpdateReward(CreateReward):
    ...


class RewardSchema(CreateReward):
    id: str
    created_at: datetime

    repository_id: str
    organization_id: str

    class Config:
        orm_mode = True
