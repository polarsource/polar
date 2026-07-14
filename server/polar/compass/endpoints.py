from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import Depends, Query, Request
from pydantic_extra_types.timezone_name import TimeZoneName
from sse_starlette.sse import EventSourceResponse

from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.exceptions import ResourceNotFound
from polar.kit.schemas import MultipleQueryFilter
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import auth
from .assistant.agent import build_assistant_agent
from .assistant.deps import AssistantDeps
from .assistant.schemas import AssistantChatRequest
from .assistant.stream import stream_assistant_run
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
    redis: Redis | None = Depends(get_redis),
) -> EventSourceResponse:
    """Stream one assistant turn as SSE: `text` deltas, renderable `block`
    events, then `done` with opaque conversation state for the next turn.

    The agent runs under the caller's auth subject: its toolset is derived
    from the token's granted scopes, so a restricted token can only reach the
    data those scopes allow.
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

    tz = ZoneInfo(timezone)
    agent, model_provider, model_name = build_assistant_agent(auth_subject.scopes)
    # The request-scoped session closes when this handler returns, before the
    # response streams — the generator opens its own session for tool calls.
    read_sessionmaker = request.state.async_read_sessionmaker

    async def event_stream():  # type: ignore[no-untyped-def]
        async with read_sessionmaker() as stream_session:
            deps = AssistantDeps(
                session=stream_session,
                auth_subject=auth_subject,
                organization_id=body.organization_id,
                timezone=tz,
                today=datetime.now(tz=tz).date(),
                redis=redis,
            )
            async for event in stream_assistant_run(
                agent,
                deps,
                body.prompt,
                body.message_history,
                model_provider=model_provider,
                model_name=model_name,
            ):
                yield event

    return EventSourceResponse(event_stream())
