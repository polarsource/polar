import structlog

from polar.logging import Logger
from polar.worker import AsyncSessionMaker, CronTrigger, JobContext, task

from .service import auth as auth_service

log: Logger = structlog.get_logger()


@task("auth.delete_expired", cron_trigger=CronTrigger(hour=0, minute=0))
async def auth_delete_expired(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await auth_service.delete_expired(session)
