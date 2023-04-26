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
            await pledge_service.mark_created_by_payment_id(
                session=session, payment_id=event["data"]["object"]["id"],
                transaction_id=event["data"]["object"]["latest_charge"])
