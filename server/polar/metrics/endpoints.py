from datetime import date

from fastapi import Depends, Query

from polar.customer.schemas import CustomerID
from polar.exceptions import PolarRequestValidationError
from polar.kit.schemas import MultipleQueryFilter
from polar.models.product_price import ProductPriceType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from . import auth
from .limits import MAX_INTERVAL_DAYS, MIN_DATE, is_under_limits
from .queries import Interval
from .schemas import MetricsLimits, MetricsResponse
from .service import metrics as metrics_service

router = APIRouter(prefix="/metrics", tags=["metrics", APITag.documented])


@router.get("/", summary="Get Metrics", response_model=MetricsResponse)
async def get(
    auth_subject: auth.MetricsRead,
    start_date: date = Query(
        ...,
        description="Start date.",
        ge=MIN_DATE,  # type: ignore
    ),
    end_date: date = Query(..., description="End date."),
    interval: Interval = Query(..., description="Interval between two timestamps."),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    product_price_type: MultipleQueryFilter[ProductPriceType] | None = Query(
        None,
        title="ProductPriceType Filter",
        description=(
            "Filter by product price type. "
            "`recurring` will filter data corresponding "
            "to subscriptions creations or renewals. "
            "`one_time` will filter data corresponding to one-time purchases."
        ),
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> MetricsResponse:
    """Get metrics about your orders and subscriptions."""

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
        interval=interval,
        organization_id=organization_id,
        product_id=product_id,
        product_price_type=product_price_type,
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
