from polar.worker import AsyncSessionMaker, MaintenanceWindow, TaskPriority, actor

from .service import customer_email_update as customer_email_update_service


@actor(
    actor_name="customer_email_update.delete_expired",
    cron_trigger=MaintenanceWindow(),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def customer_email_update_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await customer_email_update_service.delete_expired(session)
