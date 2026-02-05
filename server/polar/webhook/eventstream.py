from enum import StrEnum
from uuid import UUID

from polar.eventstream.service import publish
from polar.kit.utils import generate_uuid


class WebhookEvent(StrEnum):
    webhook_created = "webhook.created"


async def publish_webhook_event(
    organization_id: UUID,
    payload: str,
) -> None:
    """
    Publish a webhook event to the eventstream for CLI listeners.

    Args:
        organization_id: The organization to publish the event for
        payload: The raw JSON string of the webhook payload
    """
    await publish(
        WebhookEvent.webhook_created,
        {
            "webhook_event_id": str(generate_uuid()),
            "payload": payload,
        },
        organization_id=organization_id,
    )
