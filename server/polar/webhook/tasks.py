from collections.abc import Mapping
from uuid import UUID

import httpx
import structlog

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    task,
)

from .service import webhook_service

log: Logger = structlog.get_logger()


@task("webhook_event.send")
async def webhook_event_send(
    ctx: JobContext,
    webhook_event_id: UUID,
    # user_id: UUID,
    # is_test: bool,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        event = await webhook_service.get_event(session, webhook_event_id)
        if not event:
            return

        # TODO: validate URL

        headers: Mapping[str, str] = {
            "user-agent": "polar.sh webhooks",
            "webhook-id": str(event.id),
            "webhook-timestamp": str(int(utc_now().timestamp())),
            # SIGNATURE
        }

        r = httpx.post(event.webhook_endpoint.url, json=event.payload, headers=headers)

        if r.status_code >= 200 and r.status_code <= 299:
            event.succeeded = True
        else:
            event.succeeded = False

        event.http_code = r.status_code
        session.add(event)
