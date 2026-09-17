from typing import Annotated

from fastapi import Depends, Query
from pydantic import AwareDatetime

from polar.exceptions import ResourceNotFound
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter
from polar.void.auth import VoidRead

from .schemas import ActivityGroup, ActivityReport, ActivitySpan
from .service import activity as activity_service

router = APIRouter(prefix="/activities", tags=["activities"], include_in_schema=False)


@router.get("", response_model=ActivityReport, operation_id="activities:list")
async def list_activities(
    auth: VoidRead,
    identity: Annotated[str | None, Query()] = None,
    start: AwareDatetime | None = None,
    end: AwareDatetime | None = None,
    group: ActivityGroup = "run",
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ActivityReport:
    return await activity_service.report(
        session,
        auth.organization.id,
        identity=identity,
        start=start,
        end=end,
        group=group,
    )


@router.get(
    "/spans/{span_key}",
    response_model=ActivitySpan,
    operation_id="activities:span",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_span(
    span_key: str,
    auth: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ActivitySpan:
    span = await activity_service.get_span(session, auth.organization.id, span_key)
    if span is None:
        raise ResourceNotFound()
    return span
