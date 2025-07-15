import structlog

from polar.logging import Logger
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .service import magic_link as magic_link_service

log: Logger = structlog.get_logger()


@actor(
    actor_name="magic_link.delete_expired",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
)
async def magic_link_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await magic_link_service.delete_expired(session)
