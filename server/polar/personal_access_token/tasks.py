import uuid
from datetime import UTC, datetime

from polar.redis import create_redis
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .service import personal_access_token as personal_access_token_service


@actor(
    actor_name="personal_access_token.record_usage",
    priority=TaskPriority.LOW,
    max_retries=1,
    min_backoff=5_000,
)
async def record_usage(
    personal_access_token_id: uuid.UUID, last_used_at: float
) -> None:
    async with AsyncSessionMaker() as session:
        await personal_access_token_service.record_usage(
            session,
            personal_access_token_id,
            datetime.fromtimestamp(last_used_at, tz=UTC),
        )


@actor(
    actor_name="personal_access_token.batch_record_usage",
    cron_trigger=CronTrigger(minute="*"),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def batch_record_usage() -> None:
    redis = create_redis("worker")
    try:
        async with AsyncSessionMaker() as session:
            await personal_access_token_service.batch_record_usage(session, redis)
    finally:
        await redis.close()
