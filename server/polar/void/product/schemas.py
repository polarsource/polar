from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field

BillingInterval = Literal["day", "week", "month", "year"]


class RecurringPrice(BaseModel):
    type: Literal["recurring"]
    interval: BillingInterval
    interval_count: int = Field(1, ge=1)
    amount: Decimal = Field(ge=0, description="Fixed amount per interval.")
    currency: str = Field(min_length=3, max_length=3)


class OneTimePrice(BaseModel):
    type: Literal["one_time"]
    amount: Decimal = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)


ProductPrice = Annotated[RecurringPrice | OneTimePrice, Field(discriminator="type")]


class MeterTerms(BaseModel):
    included: float = Field(default=0, ge=0, allow_inf_nan=False)
    limit: Literal["hard", "soft", "unlimited"] = "hard"
    rollover_cap: float | None = Field(default=0, ge=0, allow_inf_nan=False)
