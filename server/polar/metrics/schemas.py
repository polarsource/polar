from datetime import date
from typing import TYPE_CHECKING

from pydantic import UUID4, AwareDatetime, ConfigDict, Field, create_model

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.meter.schemas import Meter as MeterSchema
from polar.organization.schemas import OrganizationID

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


class _MetricsBase(Schema):
    model_config = ConfigDict(from_attributes=True, extra="allow")


if TYPE_CHECKING:

    class Metrics(_MetricsBase):
        def __getattr__(self, name: str) -> Metric | None: ...

else:
    # Metrics fields are optional to support metrics filtering
    Metrics = create_model(
        "Metrics",
        **{m.slug: (Metric | None, None) for m in METRICS},
        __base__=_MetricsBase,
    )


class MetricsPeriodBase(Schema):
    """
    A period of time with metrics data.

    It maps each metric slug to its value for this timestamp.
    """

    model_config = ConfigDict(from_attributes=True, extra="allow")

    timestamp: AwareDatetime = Field(description="Timestamp of this period data.")


if TYPE_CHECKING:

    class MetricsPeriod(MetricsPeriodBase):
        def __getattr__(self, name: str) -> int | float | None: ...

else:
    # Metric fields are nullable to support metrics filtering with exclude_none
    MetricsPeriod = create_model(
        "MetricPeriod",
        **{m.slug: (int | float | None, None) for m in METRICS},
        __base__=MetricsPeriodBase,
    )


class MetricsTotalsBase(Schema):
    """
    Metrics totals over the whole selected period.

    It maps each metric slug to its value for this period. The aggregation is done
    differently depending on the metric type.
    """

    model_config = ConfigDict(from_attributes=True, extra="allow")


if TYPE_CHECKING:

    class MetricsTotals(MetricsTotalsBase):
        def __getattr__(self, name: str) -> int | float | None: ...


else:
    # Metric fields are nullable to support metrics filtering with exclude_none
    MetricsTotals = create_model(
        "MetricsTotals",
        **{m.slug: (int | float | None, None) for m in METRICS},
        __base__=MetricsTotalsBase,
    )


class MetricsResponse(Schema):
    """Metrics response schema."""

    periods: list[MetricsPeriod] = Field(description="List of data for each timestamp.")
    totals: MetricsTotals = Field(description="Totals for the whole selected period.")
    metrics: Metrics = Field(description="Information about the returned metrics.")


class MetricsIntervalLimit(Schema):
    """Date interval limit to get metrics for a given interval."""

    min_days: int = Field(description="Minimum number of days for this interval.")
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


# MetricDefinition schemas


class MetricDefinitionCreate(Schema):
    """Schema for creating a user-defined metric backed by a meter."""

    name: str = Field(..., description="Display name for the metric.", min_length=1)
    slug: str = Field(
        ...,
        description=(
            "Unique identifier for the metric within the organization. "
            "Must not conflict with built-in metric slugs."
        ),
        min_length=1,
    )
    meter_id: UUID4 = Field(
        ..., description="ID of the meter to use as the data source for this metric."
    )
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning this metric. "
            "**Required unless you use an organization token.**"
        ),
    )


class MetricDefinitionUpdate(Schema):
    """Schema for updating a user-defined metric."""

    name: str | None = Field(
        default=None, description="Display name for the metric.", min_length=1
    )


class MetricDefinitionSchema(IDSchema, TimestampedSchema):
    """A user-defined metric backed by a meter."""

    name: str = Field(description="Display name for the metric.")
    slug: str = Field(description="Unique identifier for the metric.")
    organization_id: UUID4 = Field(
        description="The ID of the organization owning this metric."
    )
    meter_id: UUID4 = Field(
        description="ID of the meter used as the data source for this metric."
    )
    meter: MeterSchema = Field(description="The meter used as the data source.")
