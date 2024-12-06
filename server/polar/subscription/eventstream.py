from enum import StrEnum
from typing import Any

from polar.eventstream.service import publish
from polar.models import Subscription


class SubscriptionEvent(StrEnum):
    canceled = "subscription.canceled"


async def publish_subscription_event(
    subscription: Subscription, event: SubscriptionEvent, payload: dict[str, Any]
) -> None:
    return await publish(
        event,
        payload,
        organization_id=subscription.organization.id,
    )


async def publish_subscription_cancel_event(
    subscription: Subscription,
) -> None:
    return await publish_subscription_event(
        subscription,
        SubscriptionEvent.canceled,
        {
            "id": subscription.id,
            "status": subscription.status,
        },
    )
