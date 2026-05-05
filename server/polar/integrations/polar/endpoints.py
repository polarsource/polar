import json

from fastapi import Depends, HTTPException, Request
from polar_sdk._webhooks import WebhookVerificationError, validate_event
from pydantic import ValidationError

from polar.config import settings
from polar.external_event.service import external_event as external_event_service
from polar.models.external_event import ExternalEventSource
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

router = APIRouter(
    prefix="/integrations/polar",
    tags=["integrations_polar"],
    include_in_schema=False,
)

IMPLEMENTED_WEBHOOKS = {
    "benefit_grant.created",
    "benefit_grant.updated",
    "benefit_grant.revoked",
}


@router.post("/webhook", status_code=202, name="integrations.polar.webhook")
async def webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    secret = settings.POLAR_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=500)

    raw_body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}

    try:
        validate_event(raw_body, headers, secret)
    except WebhookVerificationError:
        raise HTTPException(status_code=401)
    except ValidationError:
        # SDK doesn't recognize this event type yet — ignore for forward compat.
        return

    payload = json.loads(raw_body.decode("utf-8"))
    event_type = payload.get("type")
    if event_type not in IMPLEMENTED_WEBHOOKS:
        return

    delivery_id = headers.get("webhook-id")
    if not delivery_id:
        raise HTTPException(status_code=400)

    task_name = f"polar_self.webhook.{event_type}"
    await external_event_service.enqueue(
        session, ExternalEventSource.polar, task_name, delivery_id, payload
    )
