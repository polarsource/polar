from enum import StrEnum
from typing import Literal, TypedDict, overload

from polar.eventstream.service import publish
from polar.models.checkout import CheckoutStatus


class CheckoutEvent(StrEnum):
    updated = "checkout.updated"
    order_created = "checkout.order_created"
    subscription_created = "checkout.subscription_created"
    webhook_event_delivered = "checkout.webhook_event_delivered"


class CheckoutEventUpdatedPayload(TypedDict):
    status: CheckoutStatus


class CheckoutEventWebhookEventDeliveredPayload(TypedDict):
    status: CheckoutStatus


@overload
async def publish_checkout_event(
    client_secret: str,
    event: Literal[CheckoutEvent.updated],
    payload: CheckoutEventUpdatedPayload,
) -> None: ...


@overload
async def publish_checkout_event(
    client_secret: str,
    event: Literal[CheckoutEvent.order_created],
) -> None: ...


@overload
async def publish_checkout_event(
    client_secret: str,
    event: Literal[CheckoutEvent.subscription_created],
) -> None: ...


@overload
async def publish_checkout_event(
    client_secret: str,
    event: Literal[CheckoutEvent.webhook_event_delivered],
    payload: CheckoutEventWebhookEventDeliveredPayload,
) -> None: ...


async def publish_checkout_event(
    client_secret: str,
    event: CheckoutEvent,
    payload: CheckoutEventUpdatedPayload
    | CheckoutEventWebhookEventDeliveredPayload
    | None = None,
) -> None:
    return await publish(
        event, {**payload} if payload else {}, checkout_client_secret=client_secret
    )
