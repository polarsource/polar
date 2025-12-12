from datetime import datetime
from enum import StrEnum
from typing import Any, TypedDict
from uuid import UUID

from polar.eventstream.service import publish


class WebhookEvent(StrEnum):
    webhook_created = "webhook.created"


class WebhookEventPayload(TypedDict):
    type: str
    timestamp: str
    organization_id: str
    payload: dict[str, Any]


async def publish_webhook_event(
    organization_id: UUID,
    event_type: str,
    timestamp: datetime,
    payload: dict[str, Any],
) -> None:
    """
    Publish a webhook event to the eventstream for an organization.

    Args:
        organization_id: The organization to publish the event to
        event_type: The webhook event type (e.g., 'checkout.created')
        timestamp: The timestamp of the event
        payload: The webhook payload
    """
    event_payload: dict[str, Any] = {
        "type": event_type,
        "timestamp": timestamp.isoformat(),
        "organization_id": str(organization_id),
        "payload": payload,
    }

    await publish(
        WebhookEvent.webhook_created,
        event_payload,
        organization_id=organization_id,
    )
