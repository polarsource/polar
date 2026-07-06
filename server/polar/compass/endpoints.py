from zoneinfo import ZoneInfo

from fastapi import Depends, Query
from pydantic_extra_types.timezone_name import TimeZoneName

from polar.kit.schemas import MultipleQueryFilter
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import auth
from .schemas import Insight, InsightCategory
from .service import compass as compass_service

router = APIRouter(prefix="/compass", tags=["compass", APITag.private])


@router.get("/insights", summary="List Insights", response_model=list[Insight])
async def list_insights(
    auth_subject: auth.CompassRead,
    timezone: TimeZoneName = Query(
        default="UTC",
        description="Timezone used to resolve the current period. Default is UTC.",
    ),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    category: MultipleQueryFilter[InsightCategory] | None = Query(
        None, title="Category Filter", description="Filter by insight category."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
    redis: Redis | None = Depends(get_redis),
) -> list[Insight]:
    """
    List computed insights about your business.

    Insights are derived live from your metrics, narrated, and linked to a
    drill-down. They are ordered by importance.
    """
    return await compass_service.list_insights(
        session,
        auth_subject,
        timezone=ZoneInfo(timezone),
        organization_id=organization_id,
        category=category,
        redis=redis,
    )
