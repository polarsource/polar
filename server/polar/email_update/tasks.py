from logging import Logger

import structlog

from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import email_update as email_update_service

log: Logger = structlog.get_logger()


@actor(
    actor_name="email_update.delete_expired_record",
    priority=TaskPriority.LOW,
)
async def email_update_delete_expired_record() -> None:
    async with AsyncSessionMaker() as session:
        await email_update_service.delete_expired_record(session)
