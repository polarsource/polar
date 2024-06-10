from datetime import date, datetime
from typing import TYPE_CHECKING

from pydantic import Field, create_model

from polar.kit.schemas import Schema

from .metrics import METRICS, MetricType


class Metric(Schema):
    """Information about a metric."""

    slug: str = Field(description="Unique identifier for the metric.")
    display_name: str = Field(description="Human-readable name for the metric.")
    type: MetricType = Field(
        description=(
            "Type of the metric, useful to know the unit or format of the value."
        )
    )


if TYPE_CHECKING:

    class Metrics(Schema):
        def __getattr__(self, name: str) -> Metric: ...

else:
    Metrics = create_model(
        "Metrics", **{m.slug: (Metric, ...) for m in METRICS}, __base__=Schema
    )


class MetricsPeriodBase(Schema):
    """
    A period of time with metrics data.

    It maps each metric slug to its value for this timestamp.
    """

    timestamp: datetime = Field(description="Timestamp of this period data.")


if TYPE_CHECKING:

    class MetricsPeriod(MetricsPeriodBase):
        def __getattr__(self, name: str) -> int: ...

else:
    MetricsPeriod = create_model(
        "MetricPeriod",
        **{m.slug: (int, ...) for m in METRICS},
        __base__=MetricsPeriodBase,
    )


class MetricsResponse(Schema):
    """Metrics response schema."""

    periods: list[MetricsPeriod] = Field(description="List of data for each timestamp.")
    metrics: Metrics = Field(description="Information about the returned metrics.")


class MetricsIntervalLimit(Schema):
    """Date interval limit to get metrics for a given interval."""

    max_days: int = Field(description="Maximum number of days for this interval.")


class MetricsIntervalsLimits(Schema):
    """Date interval limits to get metrics for each interval."""

    hour: MetricsIntervalLimit = Field(description="Limits for the hour interval.")
    day: MetricsIntervalLimit = Field(description="Limits for the day interval.")
    week: MetricsIntervalLimit = Field(description="Limits for the week interval.")
    month: MetricsIntervalLimit = Field(description="Limits for the month interval.")
    year: MetricsIntervalLimit = Field(description="Limits for the year interval.")


class MetricsLimits(Schema):
    """Date limits to get metrics."""

    min_date: date = Field(description="Minimum date to get metrics.")
    intervals: MetricsIntervalsLimits = Field(description="Limits for each interval.")
