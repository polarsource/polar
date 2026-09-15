import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import AwareDatetime, BaseModel, Field, model_validator


class TimeInterval(StrEnum):
    hour = "hour"
    day = "day"
    week = "week"
    month = "month"
    year = "year"


class GroupBy(StrEnum):
    identity = "external_identity_id"
    root = "external_root_id"


class MetricsQuery(BaseModel):
    reducer_id: uuid.UUID
    start: AwareDatetime
    end: AwareDatetime
    interval: TimeInterval
    external_identity_id: str | None = Field(
        default=None,
        description=(
            "Restrict to this billing identity and everything below it. "
            "A root gives the customer's total."
        ),
    )
    group_by: GroupBy | None = Field(
        default=None,
        description=(
            "One series per actor (`external_identity_id`) or one per billable "
            "root (`external_root_id`, the top of the actor's tree)."
        ),
    )
    cumulative: bool = False

    @model_validator(mode="after")
    def valid_period(self) -> "MetricsQuery":
        if self.end <= self.start:
            raise ValueError("end must be after start")
        return self


class MetricPeriod(BaseModel):
    timestamp: datetime
    value: float | None


class MetricSeries(BaseModel):
    external_identity_id: str | None
    external_root_id: str | None
    periods: list[MetricPeriod]
    total: float | None


class Metrics(BaseModel):
    reducer_id: uuid.UUID
    interval: TimeInterval
    series: list[MetricSeries]
