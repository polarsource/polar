import structlog

from polar.logging import Logger
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .service import auth as auth_service

log: Logger = structlog.get_logger()


@actor(
    actor_name="auth.delete_expired",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def auth_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await auth_service.delete_expired(session)
