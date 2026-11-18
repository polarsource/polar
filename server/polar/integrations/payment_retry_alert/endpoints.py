import json
from typing import Any

from fastapi import Depends, HTTPException, Request
from standardwebhooks.webhooks import Webhook as StandardWebhook
from standardwebhooks.webhooks import WebhookVerificationError

from polar.config import settings
from polar.external_event.service import external_event as external_event_service
from polar.models.external_event import ExternalEventSource
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

router = APIRouter(
    prefix="/integrations/payment-retry-alert",
    tags=["integrations_payment_retry_alert"],
    include_in_schema=False,
)

WEBHOOK_EVENTS = {"alert.created"}


def _verify_webhook(raw_body: bytes, headers: dict[str, str]) -> None:
    secret = settings.PAYMENT_RETRY_ALERT_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=500)

    try:
        StandardWebhook(secret.removeprefix("whsec_")).verify(raw_body, headers)
    except WebhookVerificationError, ValueError:
        raise HTTPException(status_code=400)


@router.post(
    "/webhook", status_code=202, name="integrations.payment_retry_alert.webhook"
)
async def webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    raw_body = await request.body()
    _verify_webhook(raw_body, {k.lower(): v for k, v in request.headers.items()})

    event: dict[str, Any] = json.loads(raw_body)
    expected_mode = "LIVE" if settings.is_production() else "TEST"
    if event["organisation_mode"] != expected_mode:
        return

    event_type = event["type"]
    if event_type in WEBHOOK_EVENTS:
        await external_event_service.enqueue(
            session,
            ExternalEventSource.payment_retry_alert,
            f"payment_retry_alert.webhook.{event_type}",
            event["id"],
            event,
        )
