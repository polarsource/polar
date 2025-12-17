from collections.abc import Mapping
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
    payload: dict[str, Any],
    headers: Mapping[str, str],
) -> None:
    """
    Publish a webhook event to the eventstream for an organization.

    Args:
        headers: The headers of the event
        payload: The webhook payload
    """
    event_payload: dict[str, Any] = {
        "payload": payload,
        "headers": headers,
    }

    await publish(
        WebhookEvent.webhook_created,
        event_payload,
        organization_id=organization_id,
    )
