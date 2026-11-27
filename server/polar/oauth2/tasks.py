from polar.kit.utils import utc_now
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .repository import OAuth2ClientRepository
from .service.oauth2_token import oauth2_token as oauth2_token_service


@actor(
    actor_name="oauth2_token.delete_expired",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def oauth2_token_delete_expired() -> None:
    async with AsyncSessionMaker() as session:
        await oauth2_token_service.delete_expired(session)


@actor(
    actor_name="oauth2_client.delete_stale",
    cron_trigger=CronTrigger(hour=0, minute=30),
    priority=TaskPriority.LOW,
    max_retries=0,
    time_limit=600_000,
)
async def oauth2_client_delete_stale() -> None:
    cutoff = utc_now()
    while True:
        async with AsyncSessionMaker() as session:
            repository = OAuth2ClientRepository.from_session(session)
            deleted = await repository.delete_stale(cutoff)
        if deleted == 0:
            break
