from polar.worker import AsyncSessionMaker, CronTrigger, JobContext, task

from .service import customer_session as customer_session_service


@task("customer_session.delete_expired", cron_trigger=CronTrigger(hour=0, minute=0))
async def customer_session_delete_expired(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await customer_session_service.delete_expired(session)
