from logging import Logger

import structlog

from polar.worker import AsyncSessionMaker, CronTrigger, JobContext, task

from .service import email_update as email_update_service

log: Logger = structlog.get_logger()


@task("email_update.delete_expired_record", cron_trigger=CronTrigger(hour=0, minute=0))
async def email_update_delete_expired_record(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await email_update_service.delete_expired_record(session)
