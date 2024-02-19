import datetime

import structlog
from fastapi import APIRouter, Depends

from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import (
    TrackPageView,
    TrackPageViewResponse,
)
from .service import traffic_service

log = structlog.get_logger()

router = APIRouter(prefix="", tags=["traffic"])


@router.post(
    "/traffic/track_page_view",
    response_model=TrackPageViewResponse,
    tags=[Tags.PUBLIC],
)
async def track_page_view(
    track: TrackPageView,
    session: AsyncSession = Depends(get_db_session),
) -> TrackPageViewResponse:
    if track.article_id:
        await traffic_service.add(
            session,
            location_href=track.location_href,
            referrer=track.referrer,
            article_id=track.article_id,
            date=datetime.date.today(),
        )

    return TrackPageViewResponse(ok=True)
