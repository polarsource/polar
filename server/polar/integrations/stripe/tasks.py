import stripe

from polar.worker import JobContext, task
from polar.postgres import AsyncSessionLocal
from polar.models import Pledge
from polar.pledge.schemas import State


@task("stripe.webhook.payment_intent.succeeded")
async def payment_intent_succeeded(ctx: JobContext, event: stripe.Event) -> None:
    async with AsyncSessionLocal() as session:
        print(event)
        pledge = await Pledge.find_by(
            session=session, payment_id=event["data"]["object"]["id"]
        )
        if pledge and pledge.state == State.initiated:
            pledge.state = State.created
            await pledge.save(session=session)
