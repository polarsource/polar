from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from polar.kit.schemas import Schema
from polar.void.entitlement.schemas import SLUG_PATTERN

SenseOverType = Literal["window", "run"]
SenseWindowUnit = Literal["minute", "hour", "day"]


class SenseOverWindow(Schema):
    type: Literal["window"]
    amount: int = Field(ge=1)
    unit: SenseWindowUnit

    @model_validator(mode="after")
    def bounded(self) -> "SenseOverWindow":
        seconds = {"minute": 60, "hour": 3600, "day": 86400}[self.unit]
        if self.amount * seconds > 7 * 86400:
            raise ValueError("window must be at most 7 days")
        return self


class SenseOverRun(Schema):
    type: Literal["run"]


SenseOver = SenseOverWindow | SenseOverRun


class DeploySense(Schema):
    slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    activity: str = Field(min_length=1, pattern=SLUG_PATTERN)
    when: str = Field(min_length=1, max_length=512)
    over: SenseOver


class SenseCreate(Schema):
    version_id: str = Field(pattern=r"^[0-9a-f]{64}$")
    slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    activity_id: UUID
    activity_slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    when: str = Field(min_length=1, max_length=512)
    over: SenseOver


class CustomerSenseState(Schema):
    slug: str
    activity: str
    when: str
    over: SenseOver
    identity_id: str
    run_key: str | None
    noul: float
    span_count: int
    cost: float | None
    evaluated_at: datetime
