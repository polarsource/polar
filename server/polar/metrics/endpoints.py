from collections.abc import AsyncGenerator
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.kit.csv import CSVStreamingResponse, IterableCSVWriter
from polar.kit.time_queries import (
    MAX_INTERVAL_DAYS,
    MIN_DATE,
    MIN_INTERVAL_DAYS,
    TimeInterval,
    is_under_limits,
)
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import auth
from .metrics import METRICS
from .schemas import (
    MetricDashboardCreate,
    MetricDashboardSchema,
    MetricDashboardUpdate,
    MetricsDashboardListParams,
    MetricsExportParams,
    MetricsLimits,
    MetricsParams,
    MetricsResponse,
)
from .service import metrics as metrics_service

VALID_METRIC_SLUGS = {m.slug for m in METRICS}

router = APIRouter(prefix="/metrics", tags=["metrics", APITag.public])

MetricDashboardID = Annotated[UUID4, Path(description="The metric dashboard ID.")]


@router.get(
    "/",
    summary="Get Metrics",
    response_model=MetricsResponse,
    tags=[APITag.mcp, APITag.cli],
    response_model_exclude_none=True,
)
async def get(
    filters: Annotated[MetricsParams, Query()],
    auth_subject: auth.MetricsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
    redis: Redis | None = Depends(get_redis),
) -> MetricsResponse:
    """
    Get metrics about your orders and subscriptions.

    Currency values are output in cents.
    """
    if filters.metrics is not None:
        valid_slugs = {m.slug for m in METRICS}
        invalid_slugs = set(filters.metrics) - valid_slugs
        if invalid_slugs:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("query", "metrics"),
                        "msg": f"Invalid metric slugs: {', '.join(sorted(invalid_slugs))}",
                        "type": "value_error",
                        "input": filters.metrics,
                    }
                ]
            )

    if not is_under_limits(filters.start_date, filters.end_date, filters.interval):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("query",),
                    "msg": (
                        "The interval is too small for the given date range. "
                        "Use a larger interval or reduce the date range."
                    ),
                    "type": "value_error",
                    "input": (filters.start_date, filters.end_date, filters.interval),
                }
            ]
        )

    return await metrics_service.get_metrics(
        session,
        auth_subject,
        start_date=filters.start_date,
        end_date=filters.end_date,
        timezone=ZoneInfo(filters.timezone),
        interval=filters.interval,
        organization_id=filters.organization_id,
        product_id=filters.product_id,
        billing_type=filters.billing_type,
        customer_id=filters.customer_id,
        metrics=filters.metrics,
        redis=redis,
    )


@router.get("/export", summary="Export Metrics", response_class=CSVStreamingResponse)
async def export(
    filters: Annotated[MetricsExportParams, Query()],
    auth_subject: auth.MetricsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
    redis: Redis | None = Depends(get_redis),
) -> CSVStreamingResponse:
    """Export metrics as a CSV file."""
    if filters.metrics is not None:
        invalid_slugs = set(filters.metrics) - VALID_METRIC_SLUGS
        if invalid_slugs:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("query", "metrics"),
                        "msg": f"Invalid metric slugs: {', '.join(sorted(invalid_slugs))}",
                        "type": "value_error",
                        "input": filters.metrics,
                    }
                ]
            )

    if not is_under_limits(filters.start_date, filters.end_date, filters.interval):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("query",),
                    "msg": (
                        "The interval is too small for the given date range. "
                        "Use a larger interval or reduce the date range."
                    ),
                    "type": "value_error",
                    "input": (filters.start_date, filters.end_date, filters.interval),
                }
            ]
        )

    async def create_csv() -> AsyncGenerator[str]:
        response = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=filters.start_date,
            end_date=filters.end_date,
            timezone=ZoneInfo(filters.timezone),
            interval=filters.interval,
            organization_id=filters.organization_id,
            product_id=filters.product_id,
            billing_type=filters.billing_type,
            customer_id=filters.customer_id,
            metrics=filters.metrics,
            redis=redis,
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

    return CSVStreamingResponse(create_csv(), "polar-metrics.csv")


@router.get(
    "/limits",
    summary="Get Metrics Limits",
    response_model=MetricsLimits,
    tags=[APITag.mcp, APITag.cli],
)
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
    filters: Annotated[MetricsDashboardListParams, Query()],
    auth_subject: auth.MetricsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[MetricDashboardSchema]:
    """List user-defined metric dashboards."""
    dashboards = await metrics_service.list_dashboards(
        session,
        auth_subject,
        organization_id=filters.organization_id,
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
    updated = await metrics_service.update_dashboard(
        session, dashboard, body, auth_subject
    )
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
    await metrics_service.delete_dashboard(session, dashboard, auth_subject)
