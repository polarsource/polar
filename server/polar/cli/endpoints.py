import base64
import json
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from fastapi import Depends, Request
from sse_starlette.sse import EventSourceResponse
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.cli import auth
from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.kit.utils import utc_now
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

log = structlog.get_logger()


router = APIRouter(prefix="/cli", tags=["cli", APITag.private])


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

                    # Use organization_id as the signing secret
                    b64secret = base64.b64encode(
                        organization_id.encode("utf-8")
                    ).decode("utf-8")

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

                    event["payload"]["payload"] = json.loads(webhook_payload)

                    yield json.dumps(event)
                    continue
        except (json.JSONDecodeError, KeyError) as e:
            log.warning("Failed to transform webhook event", error=str(e))

        # Yield original message if not a webhook event or if transformation failed
        yield message


@router.get("/listen")
async def listen(
    request: Request,
    auth_subject: auth.CLIRead,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_db_session),
) -> EventSourceResponse:
    receivers = Receivers(organization_id=auth_subject.subject.id)
    event_stream = subscribe(redis, receivers.get_channels(), request)
    transformed_stream = transform_webhook_events(
        str(auth_subject.subject.id), event_stream
    )

    async def first_event_wrapper():
        # Send a first event announcing connection established
        yield json.dumps(
            {
                "key": "connected",
                "ts": str(utc_now()),
                "secret": str(auth_subject.subject.id),
            }
        )

        async for message in transformed_stream:
            yield message

    return EventSourceResponse(first_event_wrapper())
