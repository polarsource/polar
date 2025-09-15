from datetime import date
from zoneinfo import ZoneInfo

from fastapi import Depends, Query
from pydantic_extra_types.timezone_name import TimeZoneName

from polar.customer.schemas.customer import CustomerID
from polar.exceptions import PolarRequestValidationError
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.time_queries import (
    MAX_INTERVAL_DAYS,
    MIN_DATE,
    TimeInterval,
    is_under_limits,
)
from polar.models.product import ProductBillingType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from . import auth
from .schemas import MetricsLimits, MetricsResponse
from .service import metrics as metrics_service

router = APIRouter(prefix="/metrics", tags=["metrics", APITag.public, APITag.mcp])


@router.get("/", summary="Get Metrics", response_model=MetricsResponse)
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
    session: AsyncReadSession = Depends(get_db_read_session),
) -> MetricsResponse:
    """
    Get metrics about your orders and subscriptions.

    Currency values are output in cents.
    """
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
    )


@router.get("/limits", summary="Get Metrics Limits", response_model=MetricsLimits)
async def limits(auth_subject: auth.MetricsRead) -> MetricsLimits:
    """Get the interval limits for the metrics endpoint."""
    return MetricsLimits.model_validate(
        {
            "min_date": MIN_DATE,
            "intervals": {
                interval.value: {"max_days": days}
                for interval, days in MAX_INTERVAL_DAYS.items()
            },
        }
    )
