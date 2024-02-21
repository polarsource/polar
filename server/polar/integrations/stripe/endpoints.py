import stripe
import stripe.error
import stripe.webhook
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.responses import RedirectResponse

from polar.config import settings
from polar.worker import enqueue_job

log = structlog.get_logger()

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/integrations/stripe", tags=["integrations"])


DIRECT_IMPLEMENTED_WEBHOOKS = {
    "payment_intent.succeeded",
    "charge.succeeded",
    "charge.refunded",
    "charge.dispute.created",
    "charge.dispute.funds_reinstated",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
}
CONNECT_IMPLEMENTED_WEBHOOKS = {"account.updated"}


async def enqueue(event: stripe.Event) -> None:
    event_type: str = event["type"]
    task_name = f"stripe.webhook.{event_type}"
    await enqueue_job(task_name, event)
    log.info("stripe.webhook.queued", task_name=task_name)


@router.get("/refresh")
def stripe_connect_refresh(return_path: str | None = Query(None)) -> RedirectResponse:
    if return_path is None:
        raise HTTPException(404)
    return RedirectResponse(settings.generate_frontend_url(return_path))


class WebhookEventGetter:
    def __init__(self, secret: str) -> None:
        self.secret = secret

    async def __call__(self, request: Request) -> stripe.Event:
        payload = await request.body()
        sig_header = request.headers["Stripe-Signature"]

        try:
            return stripe.webhook.Webhook.construct_event(
                payload, sig_header, self.secret
            )
        except ValueError as e:
            raise HTTPException(status_code=400) from e
        except stripe.error.SignatureVerificationError as e:
            raise HTTPException(status_code=401) from e


@router.post("/webhook", status_code=202)
async def webhook(
    event: stripe.Event = Depends(WebhookEventGetter(settings.STRIPE_WEBHOOK_SECRET)),
) -> None:
    if event["type"] in DIRECT_IMPLEMENTED_WEBHOOKS:
        await enqueue(event)


@router.post("/webhook-connect", status_code=202)
async def webhook_connect(
    event: stripe.Event = Depends(
        WebhookEventGetter(settings.STRIPE_CONNECT_WEBHOOK_SECRET)
    ),
) -> None:
    if event["type"] in CONNECT_IMPLEMENTED_WEBHOOKS:
        return await enqueue(event)
