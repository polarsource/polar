"""
Mercury webhook endpoints.

Handles:
- Transaction status updates (sent, completed, failed, returned)
- ACH return notifications
"""

import hashlib
import hmac
from typing import Annotated, Any

import structlog
from fastapi import Depends, Header, HTTPException, Request
from pydantic import BaseModel

from polar.config import settings
from polar.kit.routing import APIRouter
from polar.logging import Logger
from polar.worker import enqueue_job

log: Logger = structlog.get_logger()

router = APIRouter(prefix="/integrations/mercury", tags=["integrations.mercury"])


class MercuryWebhookPayload(BaseModel):
    """Mercury webhook payload structure."""

    event: str
    data: dict[str, Any]


def verify_webhook_signature(
    payload: bytes,
    signature: str,
    secret: str,
) -> bool:
    """
    Verify Mercury webhook signature.

    Mercury uses HMAC-SHA256 for webhook signatures.
    """
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


async def verify_mercury_webhook(
    request: Request,
    x_mercury_signature: Annotated[str | None, Header()] = None,
) -> bytes:
    """
    Dependency to verify Mercury webhook signature.
    """
    if not settings.MERCURY_WEBHOOK_SECRET:
        log.warning("mercury.webhook.secret_not_configured")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    if not x_mercury_signature:
        log.warning("mercury.webhook.missing_signature")
        raise HTTPException(status_code=401, detail="Missing signature")

    payload = await request.body()

    if not verify_webhook_signature(
        payload, x_mercury_signature, settings.MERCURY_WEBHOOK_SECRET
    ):
        log.warning("mercury.webhook.invalid_signature")
        raise HTTPException(status_code=401, detail="Invalid signature")

    return payload


@router.post("/webhook")
async def mercury_webhook(
    payload: MercuryWebhookPayload,
    _verified: Annotated[bytes, Depends(verify_mercury_webhook)],
) -> dict[str, str]:
    """
    Handle Mercury webhook events.

    Supported events:
    - transaction.status_changed: Transaction status update
    - transaction.returned: ACH return notification
    """
    event_type = payload.event
    data = payload.data

    log.info(
        "mercury.webhook.received",
        event=event_type,
        transaction_id=data.get("id"),
    )

    # Route to appropriate handler
    if event_type == "transaction.status_changed":
        enqueue_job(
            "mercury.webhook.transaction_status_changed",
            transaction_id=data.get("id"),
            status=data.get("status"),
            data=data,
        )
    elif event_type == "transaction.returned":
        enqueue_job(
            "mercury.webhook.transaction_returned",
            transaction_id=data.get("id"),
            return_code=data.get("returnCode"),
            return_reason=data.get("returnReason"),
            data=data,
        )
    else:
        log.info("mercury.webhook.unhandled_event", event=event_type)

    return {"status": "ok"}
