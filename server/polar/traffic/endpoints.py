import datetime
from typing import Literal
from uuid import UUID

from fastapi import Depends, Query

from polar.article.service import article_service
from polar.auth.dependencies import WebUser
from polar.authz.service import AccessType, Authz
from polar.exceptions import BadRequest, ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.organization.schemas import OrganizationID
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import (
    TrackPageView,
    TrackPageViewResponse,
    TrafficReferrer,
    TrafficStatistics,
)
from .service import traffic_service

router = APIRouter(prefix="", tags=["traffic"], include_in_schema=IN_DEVELOPMENT_ONLY)


@router.post(
    "/traffic/track_page_view",
    response_model=TrackPageViewResponse,
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
)
async def statistics(
    auth_subject: WebUser,
    organization_id: OrganizationID | None = Query(None),
    article_id: UUID | None = Query(None),
    start_date: datetime.date = Query(...),
    end_date: datetime.date = Query(...),
    interval: Literal["month", "week", "day"] = Query(..., alias="trafficInterval"),
    group_by_article: bool = Query(False),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> TrafficStatistics:
    article_ids = []

    # filter by article id
    if article_id:
        # authz
        article = await article_service.get(session, article_id)
        if not article:
            raise ResourceNotFound()

        if not await authz.can(auth_subject.subject, AccessType.write, article):
            raise Unauthorized()

        article_ids = [article.id]
    elif organization_id:
        org = await organization_service.get(session, organization_id)
        if not org:
            raise ResourceNotFound()

        if not await authz.can(auth_subject.subject, AccessType.write, org):
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
    "/traffic/referrers",
    response_model=ListResource[TrafficReferrer],
)
async def referrers(
    pagination: PaginationParamsQuery,
    auth_subject: WebUser,
    organization_id: OrganizationID = Query(...),
    start_date: datetime.date = Query(...),
    end_date: datetime.date = Query(...),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[TrafficReferrer]:
    article_ids = []

    org = await organization_service.get(session, organization_id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    # all articles by org
    article_ids = [
        a.id
        for a in await article_service.list_by_organization_id(
            session, organization_id=org.id
        )
    ]

    results, count = await traffic_service.referrers(
        session,
        article_ids=article_ids,
        start_date=start_date,
        end_date=end_date,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [TrafficReferrer.model_validate(result) for result in results],
        count,
        pagination,
    )
