from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .repository import (
    BackofficeAuthenticationSessionRepository,
    BackofficeUserSessionRepository,
)


@actor(
    actor_name="backoffice.delete_expired_sessions",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def delete_expired_sessions() -> None:
    async with AsyncSessionMaker() as session:
        await BackofficeAuthenticationSessionRepository.from_session(
            session
        ).delete_expired()
        await BackofficeUserSessionRepository.from_session(session).delete_expired()
