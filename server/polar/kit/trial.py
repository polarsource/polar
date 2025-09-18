from datetime import datetime
from enum import StrEnum

from dateutil.relativedelta import relativedelta
from pydantic import BaseModel, Field
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
