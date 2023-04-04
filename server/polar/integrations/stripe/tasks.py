import stripe
from polar.notifications.schemas import NotificationType

from polar.worker import JobContext, task
from polar.postgres import AsyncSessionLocal
from polar.pledge.schemas import State
from polar.notifications.service import (
    PartialNotification,
    notifications as notification_service,
)
from polar.issue.service import issue as issue_service
from polar.pledge.service import pledge as pledge_service


@task("stripe.webhook.payment_intent.succeeded")
async def payment_intent_succeeded(ctx: JobContext, event: stripe.Event) -> None:
    async with AsyncSessionLocal() as session:
        pledge = await pledge_service.get_by_payment_id(
            session, event["data"]["object"]["id"]
        )
        if pledge and pledge.state == State.initiated:
            pledge.state = State.created
            await pledge.save(session=session)
