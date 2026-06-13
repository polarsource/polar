from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Path, Query
from pydantic_extra_types.timezone_name import TimeZoneName

from polar.kit.schemas import MultipleQueryFilter
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import auth
from .schemas import (
    Insight,
    InsightCategory,
    InsightFeedbackCreate,
    InsightFeedbackResponse,
)
from .service import insights as insights_service

router = APIRouter(prefix="/insights", tags=["insights", APITag.private])

InsightKey = Annotated[str, Path(description="The deterministic insight key.")]


@router.get("/", summary="List Insights", response_model=list[Insight])
async def list_insights(
    auth_subject: auth.InsightsRead,
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
    drill-down. Dismissed insights are excluded.
    """
    return await insights_service.list_insights(
        session,
        auth_subject,
        timezone=ZoneInfo(timezone),
        organization_id=organization_id,
        category=category,
        redis=redis,
    )


@router.post(
    "/{insight_key}/feedback",
    summary="Submit Insight Feedback",
    response_model=InsightFeedbackResponse,
    status_code=201,
)
async def submit_feedback(
    auth_subject: auth.InsightsWrite,
    insight_key: InsightKey,
    body: InsightFeedbackCreate,
    session: AsyncSession = Depends(get_db_session),
) -> InsightFeedbackResponse:
    """
    Record feedback on an insight.

    `dismiss` hides it from the feed; `not_useful` additionally feeds a negative
    quality signal used to tune detectors.
    """
    feedback = await insights_service.record_feedback(
        session, auth_subject, insight_key=insight_key, create=body
    )
    return InsightFeedbackResponse(
        insight_key=feedback.insight_key, action=feedback.action
    )
