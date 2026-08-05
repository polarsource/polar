from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Path, Query, Request
from pydantic import UUID4
from pydantic_extra_types.timezone_name import TimeZoneName
from sse_starlette.sse import EventSourceResponse

from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSessionMaker
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import CompassThread
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
    get_db_sessionmaker,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import auth
from .assistant.agent import build_assistant_agent
from .assistant.deps import AssistantDeps
from .assistant.schemas import AssistantChatRequest
from .assistant.stream import sse_event, stream_assistant_run
from .schemas import Insight, InsightCategory
from .service import compass as compass_service
from .threads.schemas import (
    CompassThreadSchema,
    CompassThreadUpdate,
    CompassThreadWithMessages,
)
from .threads.service import compass_thread as compass_thread_service

router = APIRouter(prefix="/compass", tags=["compass", APITag.private])

CompassThreadID = Annotated[UUID4, Path(description="The thread ID.")]


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


@router.get(
    "/threads",
    summary="List Assistant Threads",
    response_model=ListResource[CompassThreadSchema],
)
async def list_threads(
    auth_subject: auth.CompassRead,
    pagination: PaginationParamsQuery,
    organization_id: OrganizationID = Query(
        description="Organization whose threads to list."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CompassThreadSchema]:
    """List the caller's assistant conversation threads, most recent first."""
    results, count = await compass_thread_service.list(
        session, auth_subject, organization_id=organization_id, pagination=pagination
    )
    return ListResource.from_paginated_results(
        [CompassThreadSchema.model_validate(t) for t in results], count, pagination
    )


@router.get(
    "/threads/{id}",
    summary="Get Assistant Thread",
    response_model=CompassThreadWithMessages,
)
async def get_thread(
    auth_subject: auth.CompassRead,
    id: CompassThreadID,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CompassThreadWithMessages:
    """Get a thread with its rendered messages, for rehydrating the UI."""
    thread = await compass_thread_service.get(session, auth_subject, id)
    if thread is None:
        raise ResourceNotFound()
    messages, has_more = await compass_thread_service.list_messages(session, thread)
    return CompassThreadWithMessages.model_validate(
        {
            "id": thread.id,
            "created_at": thread.created_at,
            "modified_at": thread.modified_at,
            "organization_id": thread.organization_id,
            "title": thread.title,
            "messages": messages,
            "has_more": has_more,
        }
    )


@router.patch(
    "/threads/{id}",
    summary="Update Assistant Thread",
    response_model=CompassThreadSchema,
)
async def update_thread(
    auth_subject: auth.CompassWrite,
    id: CompassThreadID,
    body: CompassThreadUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> CompassThread:
    """Rename a thread."""
    thread = await compass_thread_service.get(session, auth_subject, id)
    if thread is None:
        raise ResourceNotFound()
    return await compass_thread_service.update(session, thread, body)


@router.delete(
    "/threads/{id}",
    summary="Delete Assistant Thread",
    status_code=204,
)
async def delete_thread(
    auth_subject: auth.CompassWrite,
    id: CompassThreadID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a thread and its conversation history."""
    thread = await compass_thread_service.get(session, auth_subject, id)
    if thread is None:
        raise ResourceNotFound()
    await compass_thread_service.delete(session, thread)


@router.post(
    "/assistant",
    summary="Ask the Compass Assistant",
    include_in_schema=False,
)
async def assistant_chat(
    request: Request,
    body: AssistantChatRequest,
    auth_subject: auth.CompassRead,
    timezone: TimeZoneName = Query(
        default="UTC",
        description="Timezone used to resolve metric windows. Default is UTC.",
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
    # Write sessionmaker for turn persistence; the SSE generator outlives the
    # request-scoped session, so tool calls open their own read sessions below.
    write_sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
    redis: Redis | None = Depends(get_redis),
) -> EventSourceResponse:
    """Stream one assistant turn as SSE: `text` deltas, renderable `block`
    events, then `thread` (new conversations) and `done` with the thread id.

    The agent runs under the caller's auth subject: its toolset is derived
    from the token's granted scopes, so a restricted token can only reach the
    data those scopes allow. Conversation state lives server-side on a thread.
    """
    org_ids = await get_accessible_org_ids(
        session, auth_subject, permission=OrganizationPermission.analytics_read
    )
    if body.organization_id not in org_ids:
        raise ResourceNotFound()
    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_by_id(body.organization_id)
    if organization is None or not organization.is_compass_enabled:
        raise ResourceNotFound()

    turn = await compass_thread_service.begin_turn(
        session,
        write_sessionmaker,
        auth_subject,
        organization_id=organization.id,
        prompt=body.prompt,
        thread_id=body.thread_id,
    )
    if turn is None:
        raise ResourceNotFound()
    thread_id = turn.thread.id
    thread_title = turn.thread.title
    history = turn.history
    history_last_at = turn.history_last_at
    is_new_thread = turn.is_new

    tz = ZoneInfo(timezone)
    agent, model_provider, model_name = build_assistant_agent(auth_subject.scopes)
    record_turn = compass_thread_service.turn_recorder(
        write_sessionmaker, thread_id, body.prompt
    )
    # The request-scoped session closes when this handler returns, before the
    # response streams — the generator opens its own session for tool calls.
    read_sessionmaker = request.state.async_read_sessionmaker

    async def event_stream() -> AsyncGenerator[dict[str, str]]:
        if is_new_thread:
            # Announced up-front so the client can point its URL at the
            # thread before the first token arrives.
            yield sse_event(
                "thread", {"thread_id": str(thread_id), "title": thread_title}
            )
        async with read_sessionmaker() as stream_session:
            deps = AssistantDeps(
                session=stream_session,
                auth_subject=auth_subject,
                organization_id=body.organization_id,
                timezone=tz,
                today=datetime.now(tz=tz).date(),
                redis=redis,
                history_last_at=history_last_at,
            )
            async for event in stream_assistant_run(
                agent,
                deps,
                body.prompt,
                history,
                model_provider=model_provider,
                model_name=model_name,
                record_turn=record_turn,
                thread_id=str(thread_id),
            ):
                yield event

    return EventSourceResponse(event_stream())
