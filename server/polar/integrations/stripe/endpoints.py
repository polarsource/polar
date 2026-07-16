import stripe
import structlog
from fastapi import Depends, HTTPException, Query, Request
from starlette.responses import RedirectResponse

from polar.config import settings
from polar.external_event.service import external_event as external_event_service
from polar.kit.http import get_safe_return_url
from polar.models.external_event import ExternalEventSource
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .account_risk import is_account_risk_event

log = structlog.get_logger()

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(
    prefix="/integrations/stripe", tags=["integrations_stripe"], include_in_schema=False
)


DIRECT_IMPLEMENTED_WEBHOOKS = {
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "setup_intent.succeeded",
    "setup_intent.setup_failed",
    "charge.pending",
    "charge.failed",
    "charge.succeeded",
    "charge.updated",
    "charge.dispute.created",
    "charge.dispute.updated",
    "charge.dispute.closed",
    "refund.created",
    "refund.updated",
    "refund.failed",
    "identity.verification_session.verified",
    "identity.verification_session.processing",
    "identity.verification_session.requires_input",
    "identity.verification_session.canceled",
}
CONNECT_IMPLEMENTED_WEBHOOKS = {
    "account.updated",
    "payout.updated",
    "payout.paid",
    "payout.failed",
}


async def enqueue(
    session: AsyncSession, event: stripe.Event, task_name: str | None = None
) -> None:
    # Default: one actor per event type. Callers with a dedicated actor override.
    task_name = task_name or f"stripe.webhook.{event['type']}"
    await external_event_service.enqueue(
        session, ExternalEventSource.stripe, task_name, event.id, event
    )


@router.get("/refresh", name="integrations.stripe.refresh")
async def stripe_connect_refresh(
    return_path: str | None = Query(None),
) -> RedirectResponse:
    if return_path is None:
        raise HTTPException(404)
    return RedirectResponse(get_safe_return_url(return_path))


class WebhookEventGetter:
    def __init__(self, secret: str) -> None:
        self.secret = secret

    async def __call__(self, request: Request) -> stripe.Event:
        # An empty secret verifies against an empty key, which anyone can forge.
        # Treat it as a disabled endpoint.
        if not self.secret:
            raise HTTPException(status_code=404)

        payload = await request.body()
        sig_header = request.headers.get("Stripe-Signature")
        if sig_header is None:
            raise HTTPException(status_code=400)

        try:
            return stripe.Webhook.construct_event(payload, sig_header, self.secret)
        except ValueError as e:
            raise HTTPException(status_code=400) from e
        except stripe.SignatureVerificationError as e:
            raise HTTPException(status_code=401) from e


@router.post("/webhook", status_code=202, name="integrations.stripe.webhook")
async def webhook(
    session: AsyncSession = Depends(get_db_session),
    event: stripe.Event = Depends(WebhookEventGetter(settings.STRIPE_WEBHOOK_SECRET)),
) -> None:
    if event["type"] in DIRECT_IMPLEMENTED_WEBHOOKS:
        await enqueue(session, event)


@router.post(
    "/webhook-connect", status_code=202, name="integrations.stripe.webhook_connect"
)
async def webhook_connect(
    session: AsyncSession = Depends(get_db_session),
    event: stripe.Event = Depends(
        WebhookEventGetter(settings.STRIPE_CONNECT_WEBHOOK_SECRET)
    ),
) -> None:
    if event["type"] in CONNECT_IMPLEMENTED_WEBHOOKS:
        return await enqueue(session, event)


@router.post(
    "/webhook-account-risk",
    status_code=202,
    name="integrations.stripe.webhook_account_risk",
)
async def webhook_account_risk(
    session: AsyncSession = Depends(get_db_session),
    event: stripe.Event = Depends(
        WebhookEventGetter(settings.STRIPE_ACCOUNT_RISK_WEBHOOK_SECRET)
    ),
) -> None:
    if is_account_risk_event(event["type"]):
        return await enqueue(session, event, "stripe.account_risk_signal")
