"""Plain webhook receiver — kicks off triage on relevant events.

Plain delivers signed POST requests when threads change state. We
verify the HMAC, ignore everything that isn't a fresh customer-initiated
thread, and enqueue a Dramatiq job to run the agent against it.

Register the secret in your Plain workspace (Settings → Webhooks) and
mirror it as `PLAIN_REQUEST_SIGNING_SECRET` in the API service env
(this is the existing Plain secret in `polar.config`). To wire this
router into the FastAPI app, add:

    from polar.managed_agents.webhook import router as managed_agents_router
    router.include_router(managed_agents_router)

to `server/polar/api.py` next to the other integration routers.
"""

from __future__ import annotations

import hashlib
import hmac
import logging

from fastapi import APIRouter, HTTPException, Request, status

from polar.config import settings
from polar.worker import enqueue_job

log = logging.getLogger(__name__)

router = APIRouter(prefix="/managed_agents", tags=["managed_agents"])

# Plain webhook event types that should trigger triage. Conservative
# by default — only run on the initial customer-created thread. Add
# `thread.email_received` / `thread.chat_received` here if you want to
# re-triage on every customer reply.
TRIGGER_EVENT_TYPES = frozenset({"thread.thread_created"})


def _verify_signature(body: bytes, signature: str | None) -> bool:
    secret = settings.PLAIN_REQUEST_SIGNING_SECRET
    if not secret:
        # No secret configured — refuse. The webhook endpoint is public
        # and unauthenticated otherwise.
        log.warning(
            "PLAIN_REQUEST_SIGNING_SECRET is not configured; "
            "rejecting webhook"
        )
        return False
    if not signature:
        return False
    expected = hmac.new(
        secret.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    # Plain's signature format is the hex digest, optionally prefixed
    # with `sha256=`. Accept both shapes.
    candidate = signature.removeprefix("sha256=")
    return hmac.compare_digest(expected, candidate)


@router.post(
    "/plain/webhook",
    status_code=status.HTTP_202_ACCEPTED,
    include_in_schema=False,
)
async def plain_webhook(request: Request) -> dict[str, str]:
    body = await request.body()
    signature = request.headers.get(
        "plain-signature"
    ) or request.headers.get("x-plain-signature")
    if not _verify_signature(body, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid signature",
        )

    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid json",
        ) from exc

    event_type = payload.get("type") or payload.get("eventType")
    if event_type not in TRIGGER_EVENT_TYPES:
        return {"status": "ignored", "type": event_type or ""}

    # Plain's payload shape varies slightly by event type; the thread
    # id is consistently present as one of these paths.
    thread_id = (
        payload.get("payload", {}).get("thread", {}).get("id")
        or payload.get("thread", {}).get("id")
        or payload.get("data", {}).get("thread", {}).get("id")
    )
    if not thread_id:
        log.warning(
            "plain webhook missing thread id", extra={"event_type": event_type}
        )
        return {"status": "ignored", "reason": "no thread id"}

    enqueue_job("managed_agents.plain_triage", thread_id=thread_id)
    return {"status": "queued", "thread_id": thread_id}
