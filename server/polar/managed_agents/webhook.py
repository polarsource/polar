"""Plain webhook receiver — kicks off triage on relevant events.

Plain delivers signed POST requests when threads change state. We
verify the HMAC, ignore everything that isn't a fresh customer-initiated
thread, and call Anthropic's sessions.create() directly. From there the
agent loop runs on Anthropic and dispatches tool calls into our
self-hosted sandbox worker (server/polar/managed_agents/worker.py).

There is no Dramatiq job, no streaming loop, no in-process orchestrator.
The webhook returns 202 the moment the session is queued; the worker
picks up the tool-execution work asynchronously.

To wire this router into the FastAPI app, add:

    from polar.managed_agents.webhook import router as managed_agents_router
    router.include_router(managed_agents_router)

to `server/polar/api.py` next to the other integration routers.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException, Request, status

from polar.config import settings

log = logging.getLogger(__name__)

router = APIRouter(prefix="/managed_agents", tags=["managed_agents"])

# Plain webhook event types that should trigger triage. Conservative
# by default — only run on the initial customer-created thread. Add
# `thread.email_received` / `thread.chat_received` here if you want to
# re-triage on every customer reply.
TRIGGER_EVENT_TYPES = frozenset({"thread.thread_created"})

# One module-level client. AsyncAnthropic is safe to share across
# requests; it manages its own httpx pool.
_client = AsyncAnthropic()


def _verify_signature(body: bytes, signature: str | None) -> bool:
    secret = settings.PLAIN_REQUEST_SIGNING_SECRET
    if not secret:
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
    candidate = signature.removeprefix("sha256=")
    return hmac.compare_digest(expected, candidate)


def _extract_thread_id(payload: dict[str, Any]) -> str | None:
    return (
        payload.get("payload", {}).get("thread", {}).get("id")
        or payload.get("thread", {}).get("id")
        or payload.get("data", {}).get("thread", {}).get("id")
    )


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

    thread_id = _extract_thread_id(payload)
    if not thread_id:
        log.warning(
            "plain webhook missing thread id",
            extra={"event_type": event_type},
        )
        return {"status": "ignored", "reason": "no thread id"}

    if not (
        settings.POLAR_MANAGED_AGENT_ID
        and settings.POLAR_MANAGED_ENV_ID
        and settings.POLAR_MANAGED_VAULT_ID
    ):
        log.error("managed-agents config missing; can't create session")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="managed-agents not configured",
        )

    session = await _client.beta.sessions.create(
        agent=settings.POLAR_MANAGED_AGENT_ID,
        environment_id=settings.POLAR_MANAGED_ENV_ID,
        vault_ids=[settings.POLAR_MANAGED_VAULT_ID],
        title=f"Triage {thread_id}",
        metadata={"thread_id": thread_id, "source": "plain.webhook"},
    )

    # Kick off the agent with one user message — no streaming on our
    # side. The self-hosted worker picks up the tool-execution work.
    await _client.beta.sessions.events.send(
        session.id,
        events=[
            {
                "type": "user.message",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"Triage Plain thread {thread_id}. Read it "
                            f"with getThreadDetails, look the requester "
                            f"up in Polar's DB, then post one internal "
                            f"note with a summary + draft reply. Do not "
                            f"reply to the customer."
                        ),
                    }
                ],
            }
        ],
    )

    return {
        "status": "queued",
        "session_id": session.id,
        "thread_id": thread_id,
    }
