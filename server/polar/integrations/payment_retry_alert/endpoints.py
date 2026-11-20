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


def _verify_webhook(raw_body: bytes, headers: dict[str, str]) -> dict[str, Any]:
    secret = settings.PAYMENT_RETRY_ALERT_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=500)

    try:
        return StandardWebhook(secret.removeprefix("whsec_")).verify(raw_body, headers)
    except WebhookVerificationError, ValueError:
        raise HTTPException(status_code=400)


@router.post(
    "/webhook", status_code=202, name="integrations.payment_retry_alert.webhook"
)
async def webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    event = _verify_webhook(await request.body(), dict(request.headers))
    event_type = event.get("type")
    if event_type in WEBHOOK_EVENTS:
        await external_event_service.enqueue(
            session,
            ExternalEventSource.payment_retry_alert,
            f"payment_retry_alert.webhook.{event_type}",
            event["id"],
            event,
        )
