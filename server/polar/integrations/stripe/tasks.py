from typing import Any

from polar.worker import JobContext, task


@task("stripe.webhook.payment_intent.succeeded")
async def payment_intent_created(
    ctx: JobContext, event_object: dict[str, Any]
) -> dict[str, Any]:
    print("PAYMENT INTENT SUCCEEDED")
    print(event_object)
    return event_object
    # async with AsyncSessionLocal() as session:
    #     return await handle_issue(session, scope, action, payload)
