import hashlib
import hmac
import json
import time
from datetime import timedelta
from typing import Any

from fastapi import Depends, Header, HTTPException, Request
from standardwebhooks.webhooks import Webhook as StandardWebhook
from standardwebhooks.webhooks import WebhookVerificationError

from polar.config import settings
from polar.external_event.service import external_event as external_event_service
from polar.models.external_event import ExternalEventSource
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

router = APIRouter(
    prefix="/integrations/chargeback-stop",
    tags=["integrations_chargeback_stop"],
    include_in_schema=False,
)

WEBHOOK_EVENTS = {
    "alert.created",
    "alert.updated",
}

PAYMENT_RETRY_ALERT_WEBHOOK_EVENTS = {"alert.created"}


def _verify_signature(raw_body: bytes, signature_header: str, secret: str) -> None:
    parts = dict(p.split("=", 1) for p in signature_header.split(",") if "=" in p)
    t = parts.get("t")
    v1 = parts.get("v1")

    if t is None:
        raise HTTPException(401)
    if v1 is None:
        raise HTTPException(401)
    if not t.isdigit():
        raise HTTPException(401)

    ts = int(t)
    now = int(time.time())
    if abs(now - ts) > timedelta(minutes=5).total_seconds():
        raise HTTPException(401)

    payload = f"{t}.{raw_body.decode('utf-8')}".encode()
    expected = hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()

    if not hmac.compare_digest(expected, v1):
        raise HTTPException(401)


@router.post("/webhook", status_code=202, name="integrations.chargeback_stop.webhook")
async def webhook(
    request: Request,
    x_signature: str = Header(),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    raw_body = await request.body()
    _verify_signature(raw_body, x_signature, settings.CHARGEBACK_STOP_WEBHOOK_SECRET)

    event = json.loads(raw_body)
    event_type: str = event["type"]
    if event_type in WEBHOOK_EVENTS:
        task_name = f"chargeback_stop.webhook.{event_type}"
        await external_event_service.enqueue(
            session, ExternalEventSource.chargeback_stop, task_name, event["id"], event
        )


def _verify_payment_retry_alert_webhook(
    raw_body: bytes, headers: dict[str, str]
) -> dict[str, Any]:
    secret = settings.PAYMENT_RETRY_ALERT_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=500)

    try:
        return StandardWebhook(secret.removeprefix("whsec_")).verify(raw_body, headers)
    except WebhookVerificationError, ValueError:
        raise HTTPException(status_code=400)


@router.post(
    "/payment-retry-alert/webhook",
    status_code=202,
    name="integrations.chargeback_stop.payment_retry_alert.webhook",
)
async def payment_retry_alert_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    event = _verify_payment_retry_alert_webhook(
        await request.body(), dict(request.headers)
    )
    event_type = event.get("type")
    if event_type in PAYMENT_RETRY_ALERT_WEBHOOK_EVENTS:
        await external_event_service.enqueue(
            session,
            ExternalEventSource.chargeback_stop,
            f"chargeback_stop.payment_retry_alert.webhook.{event_type}",
            event["id"],
            event,
        )
