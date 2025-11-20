import structlog

from polar.logging import Logger
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import auth as auth_service

log: Logger = structlog.get_logger()


@actor(
    actor_name="auth.delete_expired",
    priority=TaskPriority.LOW,
)
async def auth_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await auth_service.delete_expired(session)
