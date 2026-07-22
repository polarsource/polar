import structlog

from polar.logging import Logger
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .repository import AuthenticationSessionRepository, EmailOTPRepository
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


@actor(
    actor_name="email_otp.delete_expired",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def email_otp_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await EmailOTPRepository.from_session(session).delete_expired()


@actor(
    actor_name="authentication_session.delete_expired",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def authentication_session_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await AuthenticationSessionRepository.from_session(session).delete_expired()
