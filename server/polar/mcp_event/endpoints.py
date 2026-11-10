from fastapi import Depends

from polar.auth.models import is_organization
from polar.exceptions import ResourceNotFound
from polar.kit.versioning import api_version_context
from polar.models import WebhookEndpoint
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.version import CURRENT_API_VERSION
from polar.webhook.auth import WebhooksWrite

from .catalog import MCP_EVENTS
from .schemas import (
    MCPEvent,
    MCPEventList,
    MCPEventSubscribe,
    MCPEventSubscription,
    MCPEventUnsubscribe,
    OrganizationMCPEventArguments,
    UserMCPEventArguments,
)
from .service import CallbackEndpointError
from .service import mcp_event as mcp_event_service

router = APIRouter(prefix="/mcp/events", tags=["mcp_events", APITag.private])

UnknownMCPEvent = {
    "description": "Unknown event.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", response_model=MCPEventList)
async def list_mcp_events(auth_subject: WebhooksWrite) -> MCPEventList:
    arguments_schema = (
        OrganizationMCPEventArguments
        if is_organization(auth_subject)
        else UserMCPEventArguments
    )
    input_schema = arguments_schema.model_json_schema()
    # Subscriptions receive payloads in the current API version
    with api_version_context(CURRENT_API_VERSION):
        return MCPEventList(
            items=[
                MCPEvent(
                    name=name,
                    description=event.description,
                    input_schema=input_schema,
                    payload_schema=event.data.json_schema(mode="serialization"),
                )
                for name, event in MCP_EVENTS.items()
            ]
        )


@router.post(
    "/subscribe",
    response_model=MCPEventSubscription,
    responses={
        400: {
            "description": "The callback endpoint could not be verified.",
            "model": CallbackEndpointError.schema(),
        },
        404: UnknownMCPEvent,
    },
)
async def subscribe_mcp_event(
    subscribe: MCPEventSubscribe,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
) -> WebhookEndpoint:
    return await mcp_event_service.subscribe(session, auth_subject, subscribe)


@router.post("/unsubscribe", status_code=204, responses={404: UnknownMCPEvent})
async def unsubscribe_mcp_event(
    unsubscribe: MCPEventUnsubscribe,
    auth_subject: WebhooksWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await mcp_event_service.unsubscribe(session, auth_subject, unsubscribe)
