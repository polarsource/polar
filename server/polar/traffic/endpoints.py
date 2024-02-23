import datetime
from typing import Literal
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query

from polar.article.service import article_service
from polar.auth.dependencies import UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.organization.dependencies import (
    OptionalOrganizationNamePlatform,
    OrganizationNamePlatform,
)
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import (
    TrackPageView,
    TrackPageViewResponse,
    TrafficReferrers,
    TrafficStatistics,
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
    if track.article_id or track.organization_id:
        await traffic_service.add(
            session,
            location_href=track.location_href,
            referrer=track.referrer,
            article_id=track.article_id,
            organization_id=track.organization_id,
            date=datetime.date.today(),
        )

    return TrackPageViewResponse(ok=True)


@router.get(
    "/traffic/statistics",
    response_model=TrafficStatistics,
    tags=[Tags.PUBLIC],
)
async def statistics(
    auth: UserRequiredAuth,
    organization_name_platform: OptionalOrganizationNamePlatform,
    article_id: UUID | None = Query(None),
    start_date: datetime.date = Query(...),
    end_date: datetime.date = Query(...),
    interval: Literal["month", "week", "day"] = Query(...),
    group_by_article: bool = Query(False),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> TrafficStatistics:
    article_ids = []

    # filter by article id
    if article_id:
        # authz
        article = await article_service.get_loaded(session, article_id)
        if not article:
            raise ResourceNotFound()

        if not await authz.can(auth.subject, AccessType.write, article):
            raise Unauthorized()

        article_ids = [article.id]
    elif organization_name_platform:
        (org_name, org_platform) = organization_name_platform
        org = await organization_service.get_by_name(
            session, name=org_name, platform=org_platform
        )
        if not org:
            raise ResourceNotFound()

        if not await authz.can(auth.subject, AccessType.write, org):
            raise Unauthorized()

        # all articles by org
        article_ids = [
            a.id
            for a in await article_service.list_by_organization_id(
                session, organization_id=org.id
            )
        ]
    else:
        raise BadRequest("Neither article_id nor platform/organization_name specified")

    res = await traffic_service.views_statistics(
        session,
        article_ids=article_ids,
        start_date=start_date,
        end_date=end_date,
        start_of_last_period=end_date,
        interval=interval,
        group_by_article=group_by_article,
    )

    return TrafficStatistics(periods=res)


@router.get(
    "/traffic/top_referrers",
    response_model=TrafficReferrers,
    tags=[Tags.PUBLIC],
)
async def top_referrers(
    auth: UserRequiredAuth,
    organization_name_platform: OrganizationNamePlatform,
    start_date: datetime.date = Query(...),
    end_date: datetime.date = Query(...),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> TrafficReferrers:
    article_ids = []

    (org_name, org_platform) = organization_name_platform
    org = await organization_service.get_by_name(
        session, name=org_name, platform=org_platform
    )
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, org):
        raise Unauthorized()

    # all articles by org
    article_ids = [
        a.id
        for a in await article_service.list_by_organization_id(
            session, organization_id=org.id
        )
    ]

    res = await traffic_service.top_referrers(
        session,
        article_ids=article_ids,
        start_date=start_date,
        end_date=end_date,
    )

    return TrafficReferrers(referrers=res)
