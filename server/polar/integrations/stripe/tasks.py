import stripe

from polar.worker import JobContext, task
from polar.postgres import AsyncSessionLocal
from polar.models import Reward
from polar.reward.schemas import State


@task("stripe.webhook.payment_intent.succeeded")
async def payment_intent_succeeded(ctx: JobContext, event: stripe.Event) -> None:
    async with AsyncSessionLocal() as session:
        print(event)
        reward = await Reward.find_by(
            session=session, payment_id=event["data"]["object"]["id"]
        )
        if reward and reward.state == State.initiated:
            reward.state = State.created
            await reward.save(session=session)
