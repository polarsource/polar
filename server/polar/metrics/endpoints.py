from collections.abc import AsyncGenerator
from datetime import date
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Path, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import UUID4
from pydantic_extra_types.timezone_name import TimeZoneName

from polar.customer.schemas.customer import CustomerID
from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.kit.csv import IterableCSVWriter
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.time_queries import (
    MAX_INTERVAL_DAYS,
    MIN_DATE,
    MIN_INTERVAL_DAYS,
    TimeInterval,
    is_under_limits,
)
from polar.models.product import ProductBillingType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from . import auth
from .metrics import METRICS
from .schemas import (
    MetricDashboardCreate,
    MetricDashboardSchema,
    MetricDashboardUpdate,
    MetricsLimits,
    MetricsResponse,
)
from .service import metrics as metrics_service

VALID_METRIC_SLUGS = {m.slug for m in METRICS}

router = APIRouter(prefix="/metrics", tags=["metrics", APITag.public, APITag.mcp])

MetricDashboardID = Annotated[UUID4, Path(description="The metric dashboard ID.")]


@router.get(
    "/",
    summary="Get Metrics",
    response_model=MetricsResponse,
    response_model_exclude_none=True,
)
async def get(
    auth_subject: auth.MetricsRead,
    start_date: date = Query(
        ...,
        description="Start date.",
    ),
    end_date: date = Query(..., description="End date."),
    timezone: TimeZoneName = Query(
        default="UTC",
        description="Timezone to use for the timestamps. Default is UTC.",
    ),
    interval: TimeInterval = Query(..., description="Interval between two timestamps."),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    billing_type: MultipleQueryFilter[ProductBillingType] | None = Query(
        None,
        title="ProductBillingType Filter",
        description=(
            "Filter by billing type. "
            "`recurring` will filter data corresponding "
            "to subscriptions creations or renewals. "
            "`one_time` will filter data corresponding to one-time purchases."
        ),
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    metrics: list[str] | None = Query(
        None,
        title="Metrics",
        description=(
            "List of metric slugs to focus on. "
            "When provided, only the queries needed for these metrics will be executed, "
            "improving performance. If not provided, all metrics are returned."
        ),
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> MetricsResponse:
    """
    Get metrics about your orders and subscriptions.

    Currency values are output in cents.
    """
    if metrics is not None:
        valid_slugs = {m.slug for m in METRICS}
        invalid_slugs = set(metrics) - valid_slugs
        if invalid_slugs:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("query", "metrics"),
                        "msg": f"Invalid metric slugs: {', '.join(sorted(invalid_slugs))}",
                        "type": "value_error",
                        "input": metrics,
                    }
                ]
            )

    if not is_under_limits(start_date, end_date, interval):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("query",),
                    "msg": (
                        "The interval is too big. "
                        "Try to change the interval or reduce the date range."
                    ),
                    "type": "value_error",
                    "input": (start_date, end_date, interval),
                }
            ]
        )

    return await metrics_service.get_metrics(
        session,
        auth_subject,
        start_date=start_date,
        end_date=end_date,
        timezone=ZoneInfo(timezone),
        interval=interval,
        organization_id=organization_id,
        product_id=product_id,
        billing_type=billing_type,
        customer_id=customer_id,
        metrics=metrics,
    )


@router.get(
    "/export",
    summary="Export Metrics",
    responses={
        200: {
            "content": {"text/csv": {"schema": {"type": "string"}}},
        },
    },
)
async def export(
    auth_subject: auth.MetricsRead,
    start_date: date = Query(..., description="Start date."),
    end_date: date = Query(..., description="End date."),
    timezone: TimeZoneName = Query(
        default="UTC",
        description="Timezone to use for the timestamps. Default is UTC.",
    ),
    interval: TimeInterval = Query(..., description="Interval between two timestamps."),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    billing_type: MultipleQueryFilter[ProductBillingType] | None = Query(
        None,
        title="ProductBillingType Filter",
        description=(
            "Filter by billing type. "
            "`recurring` will filter data corresponding "
            "to subscriptions creations or renewals. "
            "`one_time` will filter data corresponding to one-time purchases."
        ),
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    metrics: list[str] | None = Query(
        None,
        title="Metrics",
        description=(
            "List of metric slugs to include in the export. "
            "If not provided, all metrics are exported."
        ),
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Response:
    """Export metrics as a CSV file."""
    if metrics is not None:
        invalid_slugs = set(metrics) - VALID_METRIC_SLUGS
        if invalid_slugs:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("query", "metrics"),
                        "msg": f"Invalid metric slugs: {', '.join(sorted(invalid_slugs))}",
                        "type": "value_error",
                        "input": metrics,
                    }
                ]
            )

    if not is_under_limits(start_date, end_date, interval):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("query",),
                    "msg": (
                        "The interval is too big. "
                        "Try to change the interval or reduce the date range."
                    ),
                    "type": "value_error",
                    "input": (start_date, end_date, interval),
                }
            ]
        )

    async def create_csv() -> AsyncGenerator[str, None]:
        response = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=start_date,
            end_date=end_date,
            timezone=ZoneInfo(timezone),
            interval=interval,
            organization_id=organization_id,
            product_id=product_id,
            billing_type=billing_type,
            customer_id=customer_id,
            metrics=metrics,
        )

        csv_writer = IterableCSVWriter(dialect="excel")

        # Determine which metrics are present in the response, preserving METRICS order
        metrics_info = response.metrics.model_dump(exclude_none=True)
        ordered_slugs = [m.slug for m in METRICS if m.slug in metrics_info]

        # Header row
        yield csv_writer.getrow(
            ["Timestamp"]
            + [metrics_info[slug]["display_name"] for slug in ordered_slugs]
        )

        for period in response.periods:
            yield csv_writer.getrow(
                [period.timestamp.isoformat()]
                + [getattr(period, slug, None) for slug in ordered_slugs]
            )

    filename = "polar-metrics.csv"
    return StreamingResponse(
        create_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/limits", summary="Get Metrics Limits", response_model=MetricsLimits)
async def limits(auth_subject: auth.MetricsRead) -> MetricsLimits:
    """Get the interval limits for the metrics endpoint."""
    return MetricsLimits.model_validate(
        {
            "min_date": MIN_DATE,
            "intervals": {
                interval.value: {
                    "min_days": MIN_INTERVAL_DAYS[interval],
                    "max_days": MAX_INTERVAL_DAYS[interval],
                }
                for interval in TimeInterval
            },
        }
    )


@router.get(
    "/dashboards",
    summary="List Metric Dashboards",
    response_model=list[MetricDashboardSchema],
)
async def list_dashboards(
    auth_subject: auth.MetricsRead,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[MetricDashboardSchema]:
    """List user-defined metric dashboards."""
    dashboards = await metrics_service.list_dashboards(
        session,
        auth_subject,
        organization_id=organization_id,
    )
    return [MetricDashboardSchema.model_validate(d) for d in dashboards]


@router.post(
    "/dashboards",
    summary="Create Metric Dashboard",
    response_model=MetricDashboardSchema,
    status_code=201,
)
async def create_dashboard(
    auth_subject: auth.MetricsWrite,
    body: MetricDashboardCreate,
    session: AsyncSession = Depends(get_db_session),
) -> MetricDashboardSchema:
    """Create a user-defined metric dashboard."""
    dashboard = await metrics_service.create_dashboard(session, auth_subject, body)
    return MetricDashboardSchema.model_validate(dashboard)


@router.get(
    "/dashboards/{id}",
    summary="Get Metric Dashboard",
    response_model=MetricDashboardSchema,
)
async def get_dashboard(
    auth_subject: auth.MetricsRead,
    id: MetricDashboardID,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> MetricDashboardSchema:
    """Get a user-defined metric dashboard by ID."""
    dashboard = await metrics_service.get_dashboard(session, auth_subject, id)
    if dashboard is None:
        raise ResourceNotFound()
    return MetricDashboardSchema.model_validate(dashboard)


@router.patch(
    "/dashboards/{id}",
    summary="Update Metric Dashboard",
    response_model=MetricDashboardSchema,
)
async def update_dashboard(
    auth_subject: auth.MetricsWrite,
    id: MetricDashboardID,
    body: MetricDashboardUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> MetricDashboardSchema:
    """Update a user-defined metric dashboard."""
    dashboard = await metrics_service.get_dashboard(session, auth_subject, id)
    if dashboard is None:
        raise ResourceNotFound()
    updated = await metrics_service.update_dashboard(session, dashboard, body)
    return MetricDashboardSchema.model_validate(updated)


@router.delete(
    "/dashboards/{id}",
    summary="Delete Metric Dashboard",
    status_code=204,
)
async def delete_dashboard(
    auth_subject: auth.MetricsWrite,
    id: MetricDashboardID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a user-defined metric dashboard."""
    dashboard = await metrics_service.get_dashboard(session, auth_subject, id)
    if dashboard is None:
        raise ResourceNotFound()
    await metrics_service.delete_dashboard(session, dashboard)
