from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .repository.customer_session_authentication_session import (
    CustomerSessionAuthenticationSessionRepository,
)
from .repository.customer_session_email_otp import CustomerSessionEmailOTPRepository


@actor(
    actor_name="customer_session_authentication_session.delete_expired",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def customer_session_authentication_session_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await CustomerSessionAuthenticationSessionRepository.from_session(
            session
        ).delete_expired()


@actor(
    actor_name="customer_session_email_otp.delete_expired",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def customer_session_email_otp_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await CustomerSessionEmailOTPRepository.from_session(session).delete_expired()
