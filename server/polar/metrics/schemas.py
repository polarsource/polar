from datetime import date
from typing import TYPE_CHECKING

from pydantic import UUID4, AwareDatetime, Field, create_model
from pydantic_extra_types.timezone_name import TimeZoneName

from polar.customer.schemas.customer import CustomerID
from polar.kit.schemas import IDSchema, MultipleQueryFilter, Schema, TimestampedSchema
from polar.kit.time_queries import TimeInterval
from polar.kit.versioning import QuerySchema
from polar.models.product import ProductBillingType
from polar.organization.schemas import OrganizationID
from polar.product.schemas import ProductID

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
        def __getattr__(self, name: str) -> Metric | None: ...

else:
    Metrics = create_model(
        "Metrics",
        **{m.slug: (Metric | None, None) for m in METRICS},
        __base__=Schema,
    )


class MetricsPeriodBase(Schema):
    """
    A period of time with metrics data.

    It maps each metric slug to its value for this timestamp.
    """

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


# MetricDashboard schemas


class MetricDashboardCreate(Schema):
    """Schema for creating a metrics dashboard."""

    name: str = Field(..., description="Display name for the dashboard.", min_length=1)
    metrics: list[str] = Field(
        default_factory=list,
        description="List of metric slugs to display in this dashboard.",
        max_length=10,
    )
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning this dashboard. "
            "**Required unless you use an organization token.**"
        ),
    )


class MetricDashboardUpdate(Schema):
    """Schema for updating a metrics dashboard."""

    name: str | None = Field(
        default=None, description="Display name for the dashboard.", min_length=1
    )
    metrics: list[str] | None = Field(
        default=None,
        description="List of metric slugs to display in this dashboard.",
        max_length=10,
    )


class MetricDashboardSchema(IDSchema, TimestampedSchema):
    """A user-defined metrics dashboard."""

    name: str = Field(description="Display name for the dashboard.")
    metrics: list[str] = Field(
        description="List of metric slugs displayed in this dashboard."
    )
    organization_id: UUID4 = Field(
        description="The ID of the organization owning this dashboard."
    )


class MetricsParams(QuerySchema):
    start_date: date = Field(
        ...,
        description="Start date.",
    )
    end_date: date = Field(..., description="End date.")
    timezone: TimeZoneName = Field(
        default=TimeZoneName("UTC"),
        description="Timezone to use for the timestamps. Default is UTC.",
    )
    interval: TimeInterval = Field(..., description="Interval between two timestamps.")
    organization_id: MultipleQueryFilter[OrganizationID] | None = Field(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    )
    product_id: MultipleQueryFilter[ProductID] | None = Field(
        None, title="ProductID Filter", description="Filter by product ID."
    )
    billing_type: MultipleQueryFilter[ProductBillingType] | None = Field(
        None,
        title="ProductBillingType Filter",
        description=(
            "Filter by billing type. "
            "`recurring` will filter data corresponding "
            "to subscriptions creations or renewals. "
            "`one_time` will filter data corresponding to one-time purchases."
        ),
    )
    customer_id: MultipleQueryFilter[CustomerID] | None = Field(
        None, title="CustomerID Filter", description="Filter by customer ID."
    )
    metrics: list[str] | None = Field(
        None,
        title="Metrics",
        description=(
            "List of metric slugs to focus on. "
            "When provided, only the queries needed for these metrics will be executed, "
            "improving performance. If not provided, all metrics are returned."
        ),
    )


class MetricsExportParams(MetricsParams):
    metrics: list[str] | None = Field(
        None,
        title="Metrics",
        description=(
            "List of metric slugs to include in the export. "
            "If not provided, all metrics are exported."
        ),
    )


class MetricsDashboardListParams(QuerySchema):
    organization_id: MultipleQueryFilter[OrganizationID] | None = Field(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    )
