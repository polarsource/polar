"""Plain webhook receiver — kicks off triage on relevant events.

Plain delivers signed POST requests when threads change state. We
verify the HMAC, ignore everything that isn't a fresh customer-initiated
thread, and call Anthropic's sessions.create() directly. From there the
agent loop runs on Anthropic and dispatches tool calls into our
self-hosted sandbox worker (server/polar/managed_agents/worker.py).

There is no Dramatiq job, no streaming loop, no in-process orchestrator.
The webhook returns 202 the moment the session is queued; the worker
picks up the tool-execution work asynchronously.

The header name and signing format match Plain's existing
`/integrations/plain/cards` endpoint (raw hex digest in
`plain-request-signature`, NOT `sha256=`-prefixed).
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Header, HTTPException, Request, status

from polar.config import settings

log = logging.getLogger(__name__)

router = APIRouter(prefix="/managed_agents", tags=["managed_agents"])

# Plain webhook event types that should trigger triage. Conservative
# by default — only run on the initial customer-created thread. Add
# `thread.email_received` / `thread.chat_received` here if you want to
# re-triage on every customer reply.
TRIGGER_EVENT_TYPES = frozenset({"thread.thread_created"})

# Lazy client — constructing AsyncAnthropic at import time would crash
# the FastAPI app on hosts that don't have ANTHROPIC_API_KEY set
# (notably the worker host and CI). Build per-request instead.
_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def _verify_signature(body: bytes, signature: str) -> bool:
    secret = settings.POLAR_PLAIN_WEBHOOK_SECRET
    if not secret:
        log.warning(
            "POLAR_PLAIN_WEBHOOK_SECRET is not configured; rejecting "
            "managed-agents webhook"
        )
        return False
    expected = hmac.new(
        secret.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _safe_get(payload: Any, *keys: str) -> Any:
    """Walk a JSON payload defensively — return None at the first
    non-dict intermediate. Plain occasionally sends nulls for parts of
    the envelope we don't care about."""
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _extract_thread_id(payload: dict[str, Any]) -> str | None:
    return (
        _safe_get(payload, "payload", "thread", "id")
        or _safe_get(payload, "thread", "id")
        or _safe_get(payload, "data", "thread", "id")
    )


@router.post(
    "/plain/webhook",
    status_code=status.HTTP_202_ACCEPTED,
    include_in_schema=False,
)
async def plain_webhook(
    request: Request,
    plain_request_signature: str = Header(...),
) -> dict[str, str]:
    body = await request.body()
    if not _verify_signature(body, plain_request_signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid json",
        ) from exc

    if not isinstance(payload, dict):
        return {"status": "ignored", "reason": "non-dict payload"}

    event_type = payload.get("type") or payload.get("eventType")
    if event_type not in TRIGGER_EVENT_TYPES:
        return {"status": "ignored", "type": str(event_type or "")}

    thread_id = _extract_thread_id(payload)
    if not thread_id:
        log.warning(
            "plain webhook missing thread id",
            extra={"event_type": event_type},
        )
        return {"status": "ignored", "reason": "no thread id"}

    if not (
        settings.ANTHROPIC_API_KEY
        and settings.POLAR_MANAGED_AGENT_ID
        and settings.POLAR_MANAGED_ENV_ID
        and settings.POLAR_MANAGED_VAULT_ID
    ):
        log.error("managed-agents config missing; can't create session")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="managed-agents not configured",
        )

    session_id = await trigger_triage(thread_id)
    return {
        "status": "queued",
        "session_id": session_id,
        "thread_id": thread_id,
    }


async def trigger_triage(thread_id: str) -> str:
    """Create a Managed Agent session and send the kickoff message.

    Exposed as a standalone function so the local CLI (trigger.py) can
    invoke it without forging a webhook.
    """
    client = _get_client()
    session = await client.beta.sessions.create(
        agent=settings.POLAR_MANAGED_AGENT_ID,
        environment_id=settings.POLAR_MANAGED_ENV_ID,
        vault_ids=[settings.POLAR_MANAGED_VAULT_ID],
        title=f"Triage {thread_id}",
        metadata={"thread_id": thread_id, "source": "plain.webhook"},
    )
    await client.beta.sessions.events.send(
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
    return session.id
