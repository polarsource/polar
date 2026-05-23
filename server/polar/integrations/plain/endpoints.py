import hashlib
import hmac

import structlog
from fastapi import Depends, Header, HTTPException, Request
from pydantic import BaseModel

from polar.config import settings
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import CustomerCardsRequest, CustomerCardsResponse
from .service import plain as plain_service

log = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/integrations/plain", tags=["integrations_plain"], include_in_schema=False
)


class PlainAgentReplyWebhook(BaseModel):
    """Inbound merchant reply forwarded from Plain.

    ``message_id`` is the idempotency key; ``thread_id`` routes the
    reply to the v2 agent run that sent the outbound message.
    """

    message_id: str
    thread_id: str
    text: str


@router.post("/cards")
async def get_cards(
    request: Request,
    customer_cards_request: CustomerCardsRequest,
    plain_request_signature: str = Header(...),
) -> CustomerCardsResponse:
    secret = settings.PLAIN_REQUEST_SIGNING_SECRET
    if secret is None:
        raise HTTPException(status_code=404)

    raw_body = await request.body()
    signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, plain_request_signature):
        raise HTTPException(status_code=403)

    sessionmaker = request.state.async_read_sessionmaker
    return await plain_service.get_cards(sessionmaker, customer_cards_request)


@router.post("/agent-reply", status_code=202)
async def agent_reply_webhook(
    request: Request,
    payload: PlainAgentReplyWebhook,
    plain_request_signature: str = Header(...),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Inbound merchant reply → route to the parked v2 agent run.

    HMAC-verified with the same signing secret as the cards endpoint.
    Idempotent on ``message_id`` (a duplicate delivery is acknowledged
    without re-processing). The raw merchant text is read through
    MerchantMessageReader inside the service — it is never persisted
    verbatim.
    """

    secret = settings.PLAIN_REQUEST_SIGNING_SECRET
    if secret is None:
        raise HTTPException(status_code=404)

    raw_body = await request.body()
    signature = hmac.new(
        secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature, plain_request_signature):
        raise HTTPException(status_code=403)

    from polar.organization_review_agent.repository import (
        OrganizationReviewAgentRunRepository,
    )
    from polar.organization_review_agent.service import (
        organization_review_agent_service,
    )

    repo = OrganizationReviewAgentRunRepository.from_session(session)
    run = await repo.get_latest_by_plain_thread_id(payload.thread_id)
    if run is None:
        log.info(
            "plain.agent_reply.no_run_for_thread",
            thread_id=payload.thread_id,
        )
        return {"status": "ignored_no_run"}

    # Idempotency: skip if we've already processed this message id.
    already = any(
        e.get("kind") == "merchant_replied"
        and e.get("message_id") == payload.message_id
        for e in run.events
    )
    if already:
        return {"status": "duplicate"}

    await organization_review_agent_service.record_merchant_reply(
        session,
        run,
        raw_message=payload.text,
        message_id=payload.message_id,
    )
    # Session commits at request end (framework-managed).
    return {"status": "recorded"}
