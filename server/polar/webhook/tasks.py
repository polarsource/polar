import base64
from collections.abc import Mapping
from ssl import SSLError
from uuid import UUID

import httpx
import structlog
from apscheduler.triggers.cron import CronTrigger
from dramatiq import Retry
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.config import Environment, settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models.webhook_delivery import WebhookDelivery
from polar.webhook.repository import WebhookDeliveryRepository, WebhookEventRepository
from polar.worker import (
    AsyncSessionMaker,
    HTTPXMiddleware,
    TaskPriority,
    TaskQueue,
    actor,
    enqueue_job,
)

from .service import webhook as webhook_service

log: Logger = structlog.get_logger()


class NotLatestEvent(Retry):
    pass


class DeliveryFailed(Retry):
    pass


def webhook_retry_when(retries: int, exception: Exception) -> bool:
    if isinstance(exception, NotLatestEvent):
        return True
    # HTTP delivery retries are gated inside _webhook_event_send by counting
    # actual delivery attempts, so if a Retry reaches here it's safe to proceed.
    return isinstance(exception, DeliveryFailed)


@actor(
    actor_name="webhook_event.send",
    retry_when=webhook_retry_when,
    queue_name=TaskQueue.WEBHOOKS,
)
async def webhook_event_send(webhook_event_id: UUID, redeliver: bool = False) -> None:
    async with AsyncSessionMaker() as session:
        return await _webhook_event_send(
            session, webhook_event_id=webhook_event_id, redeliver=redeliver
        )


@actor(
    actor_name="webhook_event.send.v2",
    retry_when=webhook_retry_when,
    queue_name=TaskQueue.WEBHOOKS,
)
async def webhook_event_send_dedicated_queue(
    webhook_event_id: UUID, redeliver: bool = False
) -> None:
    async with AsyncSessionMaker() as session:
        return await _webhook_event_send(
            session, webhook_event_id=webhook_event_id, redeliver=redeliver
        )


async def _webhook_event_send(
    session: AsyncSession, *, webhook_event_id: UUID, redeliver: bool = False
) -> None:
    repository = WebhookEventRepository.from_session(session)
    event = await repository.get_by_id(
        webhook_event_id, options=repository.get_eager_options()
    )
    if event is None:
        raise Exception(f"webhook event not found id={webhook_event_id}")

    bound_log = log.bind(
        id=webhook_event_id,
        type=event.type,
        webhook_endpoint_id=event.webhook_endpoint_id,
    )

    if not event.webhook_endpoint.enabled:
        bound_log.info("Webhook endpoint is disabled, skipping")
        event.skipped = True
        session.add(event)
        return

    if event.payload is None:
        bound_log.info("Archived event, skipping")
        return

    if event.succeeded and not redeliver:
        bound_log.info("Event already succeeded, skipping")
        return

    earlier_pending_count = await webhook_service.count_earlier_pending_events(
        session, event
    )
    if earlier_pending_count > 0:
        log.info(
            "Earlier events need to be delivered first, retrying later",
            id=event.id,
            type=event.type,
            webhook_endpoint_id=event.webhook_endpoint_id,
            earlier_pending_count=earlier_pending_count,
        )
        raise NotLatestEvent(delay=earlier_pending_count * 500)

    if event.skipped:
        event.skipped = False
        session.add(event)

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

    client = HTTPXMiddleware.get()
    try:
        # In development, don't send webhooks for real
        # Fail-safe to make sure we don't sent data in the real world
        if settings.ENV == Environment.development:
            delivery.http_code = event.last_http_code = 200
            delivery.response = None
        else:
            response = await client.post(
                event.webhook_endpoint.url,
                content=event.payload,
                headers=headers,
                timeout=10.0,
            )
            delivery.http_code = response.status_code
            delivery.response = (
                # Limit to first 2048 characters to avoid bloating the DB
                response.text[:2048] if response.text else None
            )
            event.last_http_code = response.status_code
            response.raise_for_status()
    # Error
    except (httpx.HTTPError, SSLError) as e:
        bound_log.info("An error occurred while sending a webhook", error=e)

        if (
            isinstance(e, httpx.HTTPStatusError)
            and e.response.status_code == 429
            and "discord" in event.webhook_endpoint.url.lower()
        ):
            rate_limit_headers = {
                k: v
                for k, v in e.response.headers.items()
                if k.lower().startswith("x-ratelimit-") or k.lower() == "retry-after"
            }
            bound_log.warning(
                "Discord rate limit exceeded",
                rate_limit_headers=rate_limit_headers,
                response_body=e.response.text[:2048] if e.response.text else None,
            )

        delivery.succeeded = False
        if delivery.response is None:
            delivery.response = str(e)

        # Count actual HTTP delivery attempts (excluding current) to decide
        # whether to retry. +1 accounts for the current attempt not yet committed.
        delivery_repository = WebhookDeliveryRepository.from_session(session)
        delivery_count = await delivery_repository.count_by_event(webhook_event_id) + 1

        # Permanent failure
        if delivery_count >= settings.WEBHOOK_MAX_RETRIES:
            event.succeeded = False
            enqueue_job("webhook_event.failed", webhook_event_id=webhook_event_id)
        # Retry
        else:
            raise DeliveryFailed() from e
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


@actor(actor_name="webhook_event.failed", priority=TaskPriority.HIGH)
async def webhook_event_failed(webhook_event_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        return await webhook_service.on_event_failed(session, webhook_event_id)


@actor(
    actor_name="webhook_event.archive",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
)
async def webhook_event_archive() -> None:
    async with AsyncSessionMaker() as session:
        return await webhook_service.archive_events(
            session, older_than=utc_now() - settings.WEBHOOK_EVENT_RETENTION_PERIOD
        )


@actor(actor_name="webhook_event.publish", priority=TaskPriority.MEDIUM)
async def webhook_event_publish(webhook_event_id: UUID, organization_id: UUID) -> None:
    """
    Publish a webhook event to the eventstream for CLI listeners.

    Args:
        webhook_event_id: ID of the webhook event to publish
        organization_id: ID of the organization (used as signing secret)
    """
    async with AsyncSessionMaker() as session:
        return await _webhook_event_publish(
            session, webhook_event_id=webhook_event_id, organization_id=organization_id
        )


async def _webhook_event_publish(
    session: AsyncSession, *, webhook_event_id: UUID, organization_id: UUID
) -> None:
    from polar.eventstream.service import publish
    from polar.webhook.eventstream import WebhookEvent

    repository = WebhookEventRepository.from_session(session)
    event = await repository.get_by_id(
        webhook_event_id, options=repository.get_eager_options()
    )
    if event is None:
        log.warning(
            "Webhook event not found for eventstream publishing",
            webhook_event_id=webhook_event_id,
        )
        return

    if event.payload is None:
        log.debug(
            "Webhook event has no payload, skipping eventstream publish",
            webhook_event_id=webhook_event_id,
        )
        return

    try:
        # Publish raw webhook event data to eventstream
        # The CLI endpoint will apply transformation (headers, signing) when sending to client
        await publish(
            WebhookEvent.webhook_created,
            {
                "webhook_event_id": str(event.id),
                "payload": event.payload,
            },
            organization_id=organization_id,
        )
    except Exception as e:
        log.warning(
            "Failed to publish webhook to eventstream",
            webhook_event_id=webhook_event_id,
            organization_id=organization_id,
            error=str(e),
        )
