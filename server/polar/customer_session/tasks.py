from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .service import customer_session as customer_session_service


@actor(
    actor_name="customer_session.delete_expired",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def customer_session_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await customer_session_service.delete_expired(session)
