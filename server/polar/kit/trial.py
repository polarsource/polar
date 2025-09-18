from datetime import datetime
from enum import StrEnum
from typing import Self

from dateutil.relativedelta import relativedelta
from pydantic import BaseModel, Field, model_validator
from pydantic_core import PydanticCustomError
from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.extensions.sqlalchemy.types import StringEnum


class TrialInterval(StrEnum):
    day = "day"
    week = "week"
    month = "month"
    year = "year"

    def get_end(self, d: datetime, count: int) -> datetime:
        match self:
            case TrialInterval.day:
                return d + relativedelta(days=count)
            case TrialInterval.week:
                return d + relativedelta(weeks=count)
            case TrialInterval.month:
                return d + relativedelta(months=count)
            case TrialInterval.year:
                return d + relativedelta(years=count)


class TrialConfigurationMixin:
    trial_interval: Mapped[TrialInterval | None] = mapped_column(
        StringEnum(TrialInterval), nullable=True, default=None
    )
    trial_interval_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )


class TrialConfigurationInputMixin(BaseModel):
    trial_interval: TrialInterval | None = Field(
        default=None, description="The interval unit for the trial period."
    )
    trial_interval_count: int | None = Field(
        default=None,
        description="The number of interval units for the trial period.",
        ge=1,
        le=1000,
    )

    @model_validator(mode="after")
    def is_complete_configuration(self) -> Self:
        if self.trial_interval is None and self.trial_interval_count is None:
            return self

        if self.trial_interval is not None and self.trial_interval_count is not None:
            return self

        raise PydanticCustomError(
            "missing",
            "Both trial_interval and trial_interval_count must be set together.",
        )


class TrialConfigurationOutputMixin(BaseModel):
    trial_interval: TrialInterval | None = Field(
        description="The interval unit for the trial period."
    )
    trial_interval_count: int | None = Field(
        description="The number of interval units for the trial period."
    )
