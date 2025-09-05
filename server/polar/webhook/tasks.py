import base64
import json
from collections.abc import Mapping
from ssl import SSLError
from uuid import UUID

import httpx
import structlog
from dramatiq import Retry
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models.webhook_delivery import WebhookDelivery
from polar.worker import AsyncSessionMaker, TaskPriority, actor, can_retry, enqueue_job

from .service import webhook as webhook_service

log: Logger = structlog.get_logger()


@actor(
    actor_name="webhook_event.send",
    max_retries=settings.WEBHOOK_MAX_RETRIES,
    priority=TaskPriority.MEDIUM,
)
async def webhook_event_send(webhook_event_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        return await _webhook_event_send(session, webhook_event_id=webhook_event_id)


async def _webhook_event_send(session: AsyncSession, *, webhook_event_id: UUID) -> None:
    event = await webhook_service.get_event_by_id(session, webhook_event_id)
    if not event:
        raise Exception(f"webhook event not found id={webhook_event_id}")

    # Parse the event type from the payload to check if endpoint still supports it
    try:
        payload_data = json.loads(event.payload)
        event_type = payload_data.get("type")
        
        # Check if the endpoint still supports this event type
        if event_type and event_type not in event.webhook_endpoint.events:
            log.info(
                "Skipping webhook event - endpoint no longer supports this event type",
                webhook_event_id=webhook_event_id,
                event_type=event_type,
                endpoint_id=event.webhook_endpoint.id,
                supported_events=event.webhook_endpoint.events,
            )
            # Mark as succeeded to prevent further retries
            event.succeeded = True
            session.add(event)
            await session.commit()
            return
    except (json.JSONDecodeError, KeyError) as e:
        # If we can't parse the payload, log and continue with delivery
        log.warning(
            "Failed to parse webhook event payload for validation",
            webhook_event_id=webhook_event_id,
            error=str(e),
        )

    ts = utc_now()

    b64secret = base64.b64encode(event.webhook_endpoint.secret.encode("utf-8")).decode(
        "utf-8"
    )

    # Sign the payload
    wh = StandardWebhook(b64secret)
    signature = wh.sign(str(event.id), ts, event.payload)

    headers: Mapping[str, str] = {
        "user-agent": "polar.sh webhooks",
        "content-type": "application/json",
        "webhook-id": str(event.id),
        "webhook-timestamp": str(int(ts.timestamp())),
        "webhook-signature": signature,
    }

    delivery = WebhookDelivery(
        webhook_event_id=webhook_event_id, webhook_endpoint_id=event.webhook_endpoint_id
    )

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                event.webhook_endpoint.url,
                content=event.payload,
                headers=headers,
                timeout=20.0,
            )
            delivery.http_code = response.status_code
            event.last_http_code = response.status_code
            response.raise_for_status()
        # Error
        except (httpx.HTTPError, SSLError) as e:
            log.debug("An errror occurred while sending a webhook", error=e)
            delivery.succeeded = False
            # Permanent failure
            if not can_retry():
                event.succeeded = False
            # Retry
            else:
                raise Retry() from e
        # Success
        else:
            delivery.succeeded = True
            event.succeeded = True
            enqueue_job("webhook_event.success", webhook_event_id=webhook_event_id)
        # Either way, save the delivery
        finally:
            assert delivery.succeeded is not None
            session.add(delivery)
            session.add(event)
            await session.commit()


@actor(actor_name="webhook_event.success", priority=TaskPriority.HIGH)
async def webhook_event_success(webhook_event_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        return await webhook_service.on_event_success(session, webhook_event_id)
