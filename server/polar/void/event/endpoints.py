from typing import Annotated

from fastapi import Body, Depends, Query

from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.void.auth import VoidRead, VoidWrite
from polar.void.tinybird import TinybirdClient

from .schemas import EventCreate, EventsIngestResponse, EventsList, EventSource
from .service import InvalidAttribution, ReservedEventName
from .service import event as event_service

router = APIRouter(prefix="/events", tags=["events"], include_in_schema=False)


@router.get("", response_model=EventsList, operation_id="events:list")
async def list_events(
    auth: VoidRead,
    tinybird: TinybirdClient,
    limit: Annotated[int, Query(ge=1, le=1000)] = 25,
    name: str | None = Query(None, description="Only events with this name"),
    external_identity_id: str | None = Query(None, description="Only this actor"),
    external_root_id: str | None = Query(None, description="Only this tree's root"),
) -> EventsList:
    return await event_service.list(
        tinybird,
        auth.organization.id,
        limit,
        external_identity_id,
        external_root_id,
        name,
    )


@router.post(
    "",
    response_model=EventsIngestResponse,
    operation_id="events:ingest",
    status_code=202,
    responses={
        400: {"model": InvalidAttribution.schema()},
        403: {"model": ReservedEventName.schema()},
    },
)
async def ingest(
    events: Annotated[list[EventCreate], Body(max_length=1000)],
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> EventsIngestResponse:
    saved, ignored = await event_service.ingest(
        session, auth.organization.id, events, EventSource.user
    )
    return EventsIngestResponse(saved=saved, ignored=ignored)
