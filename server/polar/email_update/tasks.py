from logging import Logger

import structlog

from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .service import email_update as email_update_service

log: Logger = structlog.get_logger()


@actor(
    actor_name="email_update.delete_expired_record",
    cron_trigger=CronTrigger.from_crontab("34 4 * * *"),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def email_update_delete_expired_record() -> None:
    async with AsyncSessionMaker() as session:
        await email_update_service.delete_expired_record(session)
