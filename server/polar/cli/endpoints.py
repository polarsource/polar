import base64
import json
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from fastapi import Depends, Request
from sse_starlette.sse import EventSourceResponse
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.cli import auth
from polar.cli.catalog import build_catalog
from polar.cli.listener import mark_active, mark_inactive
from polar.cli.schemas import (
    SearchRequest,
    SearchResponse,
    TriggerEvent,
    TriggerRequest,
    TriggerResponse,
)
from polar.cli.service import (
    NoActiveListener,
    SearchUnavailable,
    list_trigger_events,
    search_routes,
    trigger_event,
)
from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter
from polar.version import CURRENT_API_VERSION

log = structlog.get_logger()

router = APIRouter(prefix="/cli", tags=["cli_router", APITag.private])


async def transform_webhook_events(
    organization_id: str, event_stream: AsyncGenerator[Any, Any]
) -> AsyncGenerator[Any, Any]:
    """
    Transform webhook events before sending to CLI client.
    Adds signed headers using organization_id as the secret.
    """
    async for message in event_stream:
        try:
            event = json.loads(message)

            # Check if this is a webhook event
            if event.get("key") == "webhook.created":
                payload_data = event.get("payload", {})
                webhook_payload = payload_data.get("payload")
                webhook_event_id = payload_data.get("webhook_event_id")

                if webhook_payload and webhook_event_id:
                    ts = utc_now()

                    secret = str(organization_id).replace("-", "")

                    # Use organization_id as the signing secret
                    b64secret = base64.b64encode(secret.encode("utf-8")).decode("utf-8")

                    # Sign the payload
                    wh = StandardWebhook(b64secret)
                    signature = wh.sign(webhook_event_id, ts, webhook_payload)

                    # Add signed headers to the event
                    event["headers"] = {
                        "user-agent": "polar.sh webhooks",
                        "content-type": "application/json",
                        "webhook-id": webhook_event_id,
                        "webhook-timestamp": str(int(ts.timestamp())),
                        "webhook-signature": signature,
                    }
                    if payload_data.get("triggered"):
                        event["headers"]["x-polar-triggered"] = "true"
                    yield json.dumps(event)
                    continue
        except (json.JSONDecodeError, KeyError) as e:
            log.warning("Failed to transform webhook event", error=str(e))

        # Yield original message if not a webhook event or if transformation failed
        yield message


@router.get("/listen/{id}")
async def listen(
    id: OrganizationID,
    request: Request,
    auth_subject: auth.CLIRead,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_db_session),
) -> EventSourceResponse:
    org = await organization_service.get(session, auth_subject, id)

    if org is None:
        raise ResourceNotFound()

    await mark_active(redis, org.id)

    async def refresh_listener() -> None:
        await mark_active(redis, org.id)

    # Close the session to avoid holding locks while listening for events
    await session.commit()

    receivers = Receivers(organization_id=org.id)
    event_stream = subscribe(
        redis, receivers.get_channels(), request, on_iteration=refresh_listener
    )
    transformed_stream = transform_webhook_events(str(org.id), event_stream)

    async def first_event_wrapper() -> AsyncGenerator[str]:
        secret = str(org.id).replace("-", "")

        # Send a first event announcing connection established
        yield json.dumps(
            {
                "key": "connected",
                "ts": str(utc_now()),
                "secret": secret,
            }
        )

        try:
            async for message in transformed_stream:
                yield message
        finally:
            await mark_inactive(redis, org.id)

    return EventSourceResponse(first_event_wrapper())


@router.get("/events")
async def events(auth_subject: auth.CLIRead) -> list[TriggerEvent]:
    return list(list_trigger_events())


SearchNotAvailable = {
    "description": "The API search backend is not configured or not reachable.",
    "model": SearchUnavailable.schema(),
}


@router.post("/search", responses={503: SearchNotAvailable})
async def search(
    request: Request,
    search_request: SearchRequest,
    auth_subject: auth.CLIRead,
) -> SearchResponse:
    catalog = build_catalog(
        request.app.routes,
        getattr(request.state, "api_version", CURRENT_API_VERSION),
    )
    return await search_routes(catalog, search_request.query, search_request.limit)


OrganizationNotFound = {
    "description": "Organization not found or not accessible.",
    "model": ResourceNotFound.schema(),
}
ListenerNotActive = {
    "description": "No CLI is listening for this organization.",
    "model": NoActiveListener.schema(),
}


@router.post(
    "/trigger/{id}",
    responses={404: OrganizationNotFound, 409: ListenerNotActive},
)
async def trigger(
    id: OrganizationID,
    trigger_request: TriggerRequest,
    auth_subject: auth.CLIRead,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_db_session),
) -> TriggerResponse:
    organization = await organization_service.get(session, auth_subject, id)
    if organization is None:
        raise ResourceNotFound()
    return await trigger_event(redis, organization, trigger_request)
