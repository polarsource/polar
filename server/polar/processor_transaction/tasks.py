from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .service import processor_transaction as processor_transaction_service


@actor(
    actor_name="processor_transaction.sync_stripe",
    cron_trigger=CronTrigger(minute=5),
    priority=TaskPriority.LOW,
)
async def sync_stripe() -> None:
    async with AsyncSessionMaker() as session:
        await processor_transaction_service.sync_stripe(session)
