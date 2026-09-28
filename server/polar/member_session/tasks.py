from polar.worker import AsyncSessionMaker, MaintenanceWindow, TaskPriority, actor

from .service import member_session as member_session_service


@actor(
    actor_name="member_session.delete_expired",
    cron_trigger=MaintenanceWindow(),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def member_session_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await member_session_service.delete_expired(session)
