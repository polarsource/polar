from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .service import customer_email_update as customer_email_update_service


@actor(
    actor_name="customer_email_update.delete_expired",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def customer_email_update_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await customer_email_update_service.delete_expired(session)
