import structlog
import stripe
import stripe.error

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from polar.config import settings
from polar.worker import enqueue_job

log = structlog.get_logger()

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/integrations/stripe", tags=["integrations"])


class WebhookResponse(BaseModel):
    success: bool
    message: str | None = None
    job_id: str | None = None


IMPLEMENTED_WEBHOOKS = {
    "payment_intent.succeeded",
}


def not_implemented() -> WebhookResponse:
    return WebhookResponse(success=False, message="Not implemented")


async def enqueue(event: stripe.Event) -> WebhookResponse:
    event_type: str = event["type"]

    if event_type not in IMPLEMENTED_WEBHOOKS:
        return not_implemented()

    task_name = f"stripe.webhook.{event_type}"
    enqueued = await enqueue_job(task_name, event)
    if not enqueued:
        return WebhookResponse(success=False, message="Failed to enqueue task")

    log.info("stripe.webhook.queued", task_name=task_name)
    return WebhookResponse(success=True, job_id=enqueued.job_id)


@router.post("/webhook", response_model=WebhookResponse)
async def webhook(request: Request) -> WebhookResponse:
    event = None
    payload = await request.body()
    sig_header = request.headers["Stripe-Signature"]

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        raise e
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise e

    # Handle the event
    if event["type"] in IMPLEMENTED_WEBHOOKS:
        return await enqueue(event)
    else:
        # Should be 403 Forbidden, but...
        # Throwing unsophisticated hackers/scrapers/bots off the scent
        raise HTTPException(status_code=404)
