import stripe
import stripe.error
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from starlette.responses import RedirectResponse

from polar.account.service import account as account_service
from polar.config import settings
from polar.enums import AccountType
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.worker import enqueue_job

from .service import stripe as stripe_service

log = structlog.get_logger()

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/integrations/stripe", tags=["integrations"])


class WebhookResponse(BaseModel):
    success: bool
    message: str | None = None
    job_id: str | None = None


IMPLEMENTED_WEBHOOKS = {
    "payment_intent.succeeded",
    "charge.refunded",
    "charge.dispute.created",
    "customer.subscription.created",
    "customer.subscription.updated",
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


@router.get("/return")
async def stripe_connect_return(
    stripe_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    account = await account_service.get_by(session, stripe_id=stripe_id)
    if not account or account.account_type != AccountType.stripe:
        raise HTTPException(status_code=404, detail="Account not found")

    assert account.stripe_id

    stripe_account = stripe_service.retrieve_account(account.stripe_id)

    account.email = stripe_account.email
    account.country = stripe_account.country
    account.currency = stripe_account.default_currency
    account.is_details_submitted = stripe_account.details_submitted
    account.is_charges_enabled = stripe_account.charges_enabled
    account.is_payouts_enabled = stripe_account.payouts_enabled
    account.data = stripe_account.to_dict()
    await account.save(session)

    if account.organization_id:
        org = await organization_service.get(session, account.organization_id)
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        return RedirectResponse(
            url=settings.generate_frontend_url(
                f"/maintainer/{org.name}/finance?status=stripe-return"
            )
        )

    return RedirectResponse(
        url=settings.generate_frontend_url("/rewards?status=stripe-return")
    )


@router.get("/refresh")
def stripe_connect_refresh() -> WebhookResponse:
    return not_implemented()


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
        # Respond with a healthy response so that Stripe doesn't block this event
        raise HTTPException(status_code=200)
