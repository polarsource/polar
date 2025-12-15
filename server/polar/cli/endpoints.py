import json

import structlog
from fastapi import Depends, WebSocket, WebSocketDisconnect

from polar.auth.models import Organization, User, is_anonymous
from polar.auth.scope import Scope
from polar.eventstream.service import Receivers
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, create_redis, get_redis
from polar.routing import APIRouter

router = APIRouter(prefix="/cli", tags=["cli", APITag.private])

log = structlog.get_logger()


@router.websocket("/listen")
async def listen(
    websocket: WebSocket,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> None:
    """
    WebSocket endpoint that listens to webhook events for authenticated organizations.
    Clients must authenticate using a token in query parameters (?token=...) or Authorization header.
    The organization is inferred from the authenticated subject.
    """

    # Get auth_subject from WebSocket state (set by AuthSubjectMiddleware)
    try:
        auth_subject = websocket.state.auth_subject
    except AttributeError:
        await websocket.close(code=4001, reason="Authentication required")
        return

    # Check if authenticated
    if is_anonymous(auth_subject):
        await websocket.close(code=4001, reason="Authentication required")
        return

    # Verify required scopes
    required_scopes = {
        Scope.web_read,
        Scope.web_write,
        Scope.webhooks_read,
        Scope.webhooks_write,
    }
    if not (auth_subject.scopes & required_scopes):
        await websocket.close(code=4003, reason="Insufficient permissions")
        return

    # Check subject type
    if not isinstance(auth_subject.subject, (User, Organization)):
        await websocket.close(code=4002, reason="Invalid subject type")
        return

    # Get organization ID
    if isinstance(auth_subject.subject, Organization):
        organization_id = auth_subject.subject.id
    elif isinstance(auth_subject.subject, User):
        from polar.user_organization.service import (
            user_organization as user_organization_service,
        )

        user_organizations = await user_organization_service.list_by_user_id(
            session, auth_subject.subject.id
        )
        if not user_organizations:
            await websocket.close(code=4003, reason="User has no organizations")
            return
        organization_id = user_organizations[0].organization_id
    else:
        await websocket.close(code=4002, reason="Invalid subject type")
        return

    await websocket.accept()
    redis = create_redis("app")

    # Use eventstream channel format
    receivers = Receivers(organization_id=organization_id)
    channels = receivers.get_channels()

    try:
        pubsub = redis.pubsub()
        await pubsub.subscribe(*channels)

        log.info(
            "WebSocket client subscribed to eventstream channels",
            organization_id=str(organization_id),
            channels=channels,
        )

        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    event_data = json.loads(message["data"])
                    # Extract webhook payload from eventstream event
                    if "payload" in event_data and "key" in event_data:
                        # This is an eventstream event, send the nested payload
                        await websocket.send_json(event_data["payload"])
                    else:
                        # Fallback for any non-eventstream format
                        await websocket.send_json(event_data)
                except json.JSONDecodeError as e:
                    log.warning("Failed to decode event message", error=str(e))
                except Exception as e:
                    log.warning("Failed to send event to client", error=str(e))
                    break

    except WebSocketDisconnect:
        log.info(
            "WebSocket client disconnected from eventstream",
            organization_id=str(organization_id),
        )
    except Exception as e:
        log.error("WebSocket error", error=str(e), organization_id=str(organization_id))
    finally:
        await pubsub.unsubscribe(*channels)
        await pubsub.close()
        await redis.close()
