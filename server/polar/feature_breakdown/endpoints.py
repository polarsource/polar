from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Query

from polar.metrics.auth import MetricsRead
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from .schemas import (
    FeatureBreakdown,
    FeatureBreakdownParams,
    FeatureDetail,
    FeatureHighlights,
)
from .service import feature_breakdown as feature_breakdown_service

router = APIRouter(
    prefix="/feature-breakdown", tags=["feature-breakdown", APITag.private]
)


@router.get("/", summary="Get Feature Breakdown", response_model=FeatureBreakdown)
async def get(
    filters: Annotated[FeatureBreakdownParams, Query()],
    auth_subject: MetricsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> FeatureBreakdown:
    """Usage, cost to serve and estimated revenue per feature."""
    return await feature_breakdown_service.get(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        timezone=ZoneInfo(filters.timezone),
        interval=filters.interval,
    )


@router.get("/{name}", summary="Get Feature Economics", response_model=FeatureDetail)
async def get_feature(
    name: str,
    filters: Annotated[FeatureBreakdownParams, Query()],
    auth_subject: MetricsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> FeatureDetail:
    """Customers, plans and periods of one feature."""
    return await feature_breakdown_service.get_feature(
        session,
        auth_subject,
        name=name,
        organization_id=filters.organization_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        timezone=ZoneInfo(filters.timezone),
        interval=filters.interval,
    )


@router.get(
    "/{name}/highlights",
    summary="Get Feature Highlights",
    response_model=FeatureHighlights,
)
async def get_feature_highlights(
    name: str,
    filters: Annotated[FeatureBreakdownParams, Query()],
    auth_subject: MetricsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> FeatureHighlights:
    """Cost anomalies and the largest LLM calls of one feature."""
    return await feature_breakdown_service.get_highlights(
        session,
        auth_subject,
        name=name,
        organization_id=filters.organization_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        timezone=ZoneInfo(filters.timezone),
    )
