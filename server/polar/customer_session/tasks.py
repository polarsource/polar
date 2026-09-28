from polar.worker import AsyncSessionMaker, MaintenanceWindow, TaskPriority, actor

from .service import customer_session as customer_session_service


@actor(
    actor_name="customer_session.delete_expired",
    cron_trigger=MaintenanceWindow(),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def customer_session_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await customer_session_service.delete_expired(session)
