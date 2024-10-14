import base64
import socket
from collections.abc import Mapping
from urllib.parse import urlparse
from uuid import UUID

import httpx
import structlog
from arq import Retry
from netaddr import IPAddress
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models.webhook_delivery import WebhookDelivery
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    compute_backoff,
    task,
)

from .service import webhook as webhook_service

log: Logger = structlog.get_logger()

MAX_RETRIES = 10


@task("webhook_event.send")
async def webhook_event_send(
    ctx: JobContext,
    webhook_event_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        return await _webhook_event_send(
            session, ctx=ctx, webhook_event_id=webhook_event_id
        )


def allowed_url(url: str) -> bool:
    """
    Webhooks can only be sent over HTTPS, to global IPs.
    Webhooks can not be sent to loopback or "internal" or "reserved" ranges
    """

    parsed = urlparse(url)

    if parsed.scheme != "https":
        return False

    try:
        info = socket.getaddrinfo(
            parsed.hostname,
            0,
            # 0  # port, required
        )
    except:  # noqa: E722
        return False

    # must resolve to at least one address
    if len(info) == 0:
        return False

    for family, type, proto, canonname, sockaddr in info:
        if (
            family != socket.AddressFamily.AF_INET
            and family != socket.AddressFamily.AF_INET6
        ):
            return False

        ip = sockaddr[0]

        ipp = IPAddress(ip)
        if not ipp.is_global():
            return False

    return True


async def _webhook_event_send(
    session: AsyncSession,
    *,
    ctx: JobContext,
    webhook_event_id: UUID,
) -> None:
    event = await webhook_service.get_event_by_id(session, webhook_event_id)
    if not event:
        raise Exception(f"webhook event not found id={webhook_event_id}")

    if not allowed_url(event.webhook_endpoint.url):
        raise Exception(
            f"invalid webhook url id={webhook_event_id} url={event.webhook_endpoint.url}"
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

    try:
        response = httpx.post(
            event.webhook_endpoint.url,
            content=event.payload,
            headers=headers,
            timeout=20.0,
        )
        delivery.http_code = response.status_code
        event.last_http_code = response.status_code
        response.raise_for_status()
    # Error
    except httpx.HTTPError as e:
        delivery.succeeded = False
        # Permanent failure
        if ctx["job_try"] >= MAX_RETRIES:
            event.succeeded = False
        # Retry
        else:
            raise Retry(compute_backoff(ctx["job_try"])) from e
    # Success
    else:
        delivery.succeeded = True
        event.succeeded = True
    # Either way, save the delivery
    finally:
        assert delivery.succeeded is not None
        session.add(delivery)
        session.add(event)
        await session.commit()
