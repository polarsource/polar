import stripe
import structlog
from fastapi import Depends, HTTPException, Query, Request
from starlette.responses import RedirectResponse

from polar.config import settings
from polar.routing import APIRouter
from polar.worker import enqueue_job

log = structlog.get_logger()

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(
    prefix="/integrations/stripe", tags=["integrations_stripe"], include_in_schema=False
)


DIRECT_IMPLEMENTED_WEBHOOKS = {
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "charge.succeeded",
    "charge.dispute.closed",
    "refund.created",
    "refund.updated",
    "refund.failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
}
CONNECT_IMPLEMENTED_WEBHOOKS = {"account.updated", "payout.paid"}


async def enqueue(event: stripe.Event) -> None:
    event_type: str = event["type"]
    task_name = f"stripe.webhook.{event_type}"
    enqueue_job(task_name, event)
    log.info("stripe.webhook.queued", task_name=task_name)


@router.get("/refresh", name="integrations.stripe.refresh")
async def stripe_connect_refresh(
    return_path: str | None = Query(None),
) -> RedirectResponse:
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
            return stripe.Webhook.construct_event(payload, sig_header, self.secret)
        except ValueError as e:
            raise HTTPException(status_code=400) from e
        except stripe.SignatureVerificationError as e:
            raise HTTPException(status_code=401) from e


@router.post("/webhook", status_code=202, name="integrations.stripe.webhook")
async def webhook(
    event: stripe.Event = Depends(WebhookEventGetter(settings.STRIPE_WEBHOOK_SECRET)),
) -> None:
    if event["type"] in DIRECT_IMPLEMENTED_WEBHOOKS:
        await enqueue(event)


@router.post(
    "/webhook-connect", status_code=202, name="integrations.stripe.webhook_connect"
)
async def webhook_connect(
    event: stripe.Event = Depends(
        WebhookEventGetter(settings.STRIPE_CONNECT_WEBHOOK_SECRET)
    ),
) -> None:
    if event["type"] in CONNECT_IMPLEMENTED_WEBHOOKS:
        return await enqueue(event)
