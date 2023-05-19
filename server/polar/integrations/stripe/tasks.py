import stripe

from polar.worker import JobContext, PolarWorkerContext, task
from polar.postgres import AsyncSessionLocal
from polar.pledge.service import pledge as pledge_service


@task("stripe.webhook.payment_intent.succeeded")
async def payment_intent_succeeded(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionLocal() as session:
            payment_intent = event["data"]["object"]
            await pledge_service.mark_created_by_payment_id(
                session=session,
                payment_id=payment_intent["id"],
                amount=payment_intent["amount"],
                transaction_id=payment_intent["latest_charge"],
            )


@task("stripe.webhook.charge.refunded")
async def charge_refunded(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionLocal() as session:
            charge = event["data"]["object"]
            await pledge_service.refund_by_payment_id(
                session=session,
                payment_id=charge["payment_intent"],
                amount=charge["amount_refunded"],
                transaction_id=charge["id"],
            )


@task("stripe.webhook.charge.dispute.created")
async def charge_dispute_created(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionLocal() as session:
            dispute = event["data"]["object"]
            await pledge_service.mark_charge_disputed_by_payment_id(
                session=session,
                payment_id=dispute["payment_intent"],
                amount=dispute["amount"],
                transaction_id=dispute["id"],
            )
