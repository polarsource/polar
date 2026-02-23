from enum import StrEnum
from uuid import UUID

from polar.cli.listener import has_active_listener
from polar.eventstream.service import publish
from polar.kit.utils import generate_uuid
from polar.redis import Redis, create_redis


class WebhookEvent(StrEnum):
    webhook_created = "webhook.created"


_check_redis: Redis | None = None


def _get_check_redis() -> Redis:
    global _check_redis
    if _check_redis is None:
        _check_redis = create_redis("app")
    return _check_redis


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
    redis = _get_check_redis()
    if not await has_active_listener(redis, organization_id):
        return

    await publish(
        WebhookEvent.webhook_created,
        {
            "webhook_event_id": str(generate_uuid()),
            "payload": payload,
        },
        organization_id=organization_id,
    )
