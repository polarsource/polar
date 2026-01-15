import uuid
from datetime import UTC, datetime

from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import personal_access_token as personal_access_token_service


def _record_usage_debounce_key(
    personal_access_token_id: uuid.UUID, last_used_at: float
) -> str:
    return f"personal_access_token.record_usage:{personal_access_token_id}"


@actor(
    actor_name="personal_access_token.record_usage",
    priority=TaskPriority.LOW,
    max_retries=1,
    min_backoff=5_000,
    debounce_key=_record_usage_debounce_key,
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
