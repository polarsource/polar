from typing import Any

import structlog
from fastapi import Depends, HTTPException, Request
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.config import settings
from polar.email.repository import EmailLogRepository
from polar.logging import Logger
from polar.models.email_log import EmailLogStatus
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

log: Logger = structlog.get_logger()

router = APIRouter(
    prefix="/integrations/resend",
    tags=["integrations_resend"],
    include_in_schema=False,
)

HANDLED_EVENTS = {"email.bounced", "email.failed", "email.suppressed"}

# Resend sends svix-* headers, but StandardWebhook expects webhook-*
_SVIX_TO_STANDARD = {
    "svix-id": "webhook-id",
    "svix-timestamp": "webhook-timestamp",
    "svix-signature": "webhook-signature",
}


def _remap_svix_headers(headers: dict[str, str]) -> dict[str, str]:
    return {_SVIX_TO_STANDARD.get(k.lower(), k.lower()): v for k, v in headers.items()}


def _verify_webhook(raw_body: bytes, headers: dict[str, str]) -> Any:
    secret = settings.RESEND_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=500)

    # Resend secrets use whsec_ prefix; StandardWebhook expects raw base64
    if secret.startswith("whsec_"):
        secret = secret[6:]

    try:
        wh = StandardWebhook(secret)
        return wh.verify(raw_body, _remap_svix_headers(headers))
    except Exception:
        return None


def _extract_error(event_type: str, data: dict[str, Any]) -> str:
    parts = [event_type]

    if event_type in ("email.bounced", "email.failed"):
        bounce = data.get("bounce", {})
        if bounce:
            parts.append(f"type={bounce.get('type', 'unknown')}")
            if msg := bounce.get("message"):
                parts.append(msg[:500])
    elif event_type == "email.suppressed":
        if reason := data.get("reason"):
            parts.append(f"reason={reason}")

    return "; ".join(parts)


@router.post("/webhook", status_code=200, name="integrations.resend.webhook")
async def webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    raw_body = await request.body()
    event = _verify_webhook(raw_body, dict(request.headers))
    if event is None:
        return

    event_type = event.get("type", "")
    if event_type not in HANDLED_EVENTS:
        return

    data = event.get("data", {})
    email_id = data.get("email_id")
    if not email_id:
        log.warning("resend.webhook.missing_email_id", event_type=event_type)
        return

    repository = EmailLogRepository.from_session(session)
    email_log = await repository.get_by_processor_id(email_id)
    if email_log is None:
        log.warning(
            "resend.webhook.email_log_not_found",
            event_type=event_type,
            email_id=email_id,
        )
        return

    if email_log.status == EmailLogStatus.failed:
        return

    error = _extract_error(event_type, data)
    await repository.mark_failed(email_log, error)

    log.info(
        "resend.webhook.email_marked_failed",
        event_type=event_type,
        email_id=email_id,
        email_log_id=str(email_log.id),
    )
