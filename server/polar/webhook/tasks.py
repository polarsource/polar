import base64
from collections.abc import Mapping
from ssl import SSLError
from uuid import UUID

import httpx
import structlog
from apscheduler.triggers.cron import CronTrigger
from dramatiq import Retry
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models.webhook_delivery import WebhookDelivery
from polar.webhook.repository import WebhookEventRepository
from polar.worker import (
    AsyncSessionMaker,
    HTTPXMiddleware,
    TaskPriority,
    actor,
    can_retry,
    enqueue_job,
)

from .service import webhook as webhook_service

log: Logger = structlog.get_logger()


@actor(
    actor_name="webhook_event.send",
    max_retries=settings.WEBHOOK_MAX_RETRIES,
    priority=TaskPriority.MEDIUM,
)
async def webhook_event_send(webhook_event_id: UUID, redeliver: bool = False) -> None:
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

    if not await webhook_service.is_latest_event(session, event):
        log.info(
            "Earlier events need to be delivered first, retrying later",
            id=event.id,
            type=event.type,
            webhook_endpoint_id=event.webhook_endpoint_id,
        )
        raise Retry()

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
        response = await client.post(
            event.webhook_endpoint.url,
            content=event.payload,
            headers=headers,
            timeout=20.0,
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

        # Permanent failure
        if not can_retry():
            event.succeeded = False
            enqueue_job("webhook_event.failed", webhook_event_id=webhook_event_id)
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
