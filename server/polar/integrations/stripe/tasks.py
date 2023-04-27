import stripe

from polar.worker import JobContext, PolarWorkerContext, task
from polar.postgres import AsyncSessionLocal
from polar.pledge.service import pledge as pledge_service


@task("stripe.webhook.payment_intent.succeeded")
async def payment_intent_succeeded(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            payment_intent = event["data"]["object"]
            await pledge_service.mark_created_by_payment_id(
                session=session, payment_id=payment_intent["id"],
                amount=payment_intent["amount"],
                transaction_id=payment_intent["latest_charge"])

@task("stripe.webhook.transfer.createed")
async def transfer_created(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            transfer = event["data"]["object"]
            await pledge_service.mark_paid_by_payment_id(
                session=session, payment_id=transfer["transfer_group"],
                amount=transfer["amount"],
                transaction_id=transfer["id"])
