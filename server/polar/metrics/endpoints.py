from datetime import date

from fastapi import Depends, Query
from pydantic import UUID4

from polar.kit.routing import APIRouter
from polar.models.product_price import ProductPriceType
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .queries import Interval
from .schemas import MetricsResponse
from .service import metrics as metrics_service

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/", response_model=MetricsResponse, tags=[Tags.PUBLIC])
async def get_metrics(
    auth_subject: auth.MetricsRead,
    start_date: date = Query(..., description="Start date."),
    end_date: date = Query(..., description="End date."),
    interval: Interval = Query(..., description="Interval between two timestamps."),
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    product_id: UUID4 | None = Query(None, description="Filter by product ID."),
    product_price_type: ProductPriceType | None = Query(
        None,
        description=(
            "Filter by product price type. "
            "`recurring` will filter data corresponding "
            "to subscriptions creations or renewals. "
            "`one_time` will filter data corresponding to one-time purchases."
        ),
    ),
    session: AsyncSession = Depends(get_db_session),
) -> MetricsResponse:
    """Get metrics about your orders and subscriptions."""
    return await metrics_service.get_metrics(
        session,
        auth_subject,
        start_date=start_date,
        end_date=end_date,
        interval=interval,
        organization_id=organization_id,
        product_id=product_id,
        product_price_type=product_price_type,
    )
