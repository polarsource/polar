from polar.worker import AsyncSessionMaker, MaintenanceWindow, TaskPriority, actor

from .service.oauth2_token import oauth2_token as oauth2_token_service


@actor(
    actor_name="oauth2_token.delete_expired",
    cron_trigger=MaintenanceWindow(),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def oauth2_token_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await oauth2_token_service.delete_expired(session)
