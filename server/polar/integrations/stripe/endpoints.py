import stripe
import stripe.error
import stripe.webhook
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
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


DIRECT_IMPLEMENTED_WEBHOOKS = {
    "payment_intent.succeeded",
    "charge.succeeded",
    "charge.refunded",
    "charge.dispute.created",
    "charge.dispute.funds_reinstated",
    "customer.subscription.created",
    "customer.subscription.updated",
    "invoice.paid",
}
CONNECT_IMPLEMENTED_WEBHOOKS = {
    "payout.paid",
}


async def enqueue(event: stripe.Event) -> None:
    event_type: str = event["type"]
    task_name = f"stripe.webhook.{event_type}"
    await enqueue_job(task_name, event)
    log.info("stripe.webhook.queued", task_name=task_name)


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
    account.is_details_submitted = stripe_account.details_submitted or False
    account.is_charges_enabled = stripe_account.charges_enabled or False
    account.is_payouts_enabled = stripe_account.payouts_enabled or False
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


@router.get("/refresh", status_code=204)
def stripe_connect_refresh() -> None:
    return None


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
    event: stripe.Event = Depends(WebhookEventGetter(settings.STRIPE_WEBHOOK_SECRET))
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
