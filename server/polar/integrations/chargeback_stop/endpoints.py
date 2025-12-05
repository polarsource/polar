import hashlib
import hmac
import json
import time
from datetime import timedelta

from fastapi import Depends, Header, HTTPException, Request

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
