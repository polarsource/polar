import uuid
from datetime import UTC, datetime

from polar.worker import AsyncSessionMaker, TaskPriority, actor
from polar.worker._broker import BrokerType

from .repository import OrganizationAccessTokenRepository


def _record_usage_debounce_key(
    organization_access_token_id: uuid.UUID, last_used_at: float
) -> str:
    return f"organization_access_token.record_usage:{organization_access_token_id}"


@actor(
    actor_name="organization_access_token.record_usage",
    priority=TaskPriority.LOW,
    max_retries=1,
    min_backoff=5_000,
    debounce_key=_record_usage_debounce_key,
    broker_type=BrokerType.RABBITMQ,
)
async def record_usage(
    organization_access_token_id: uuid.UUID, last_used_at: float
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationAccessTokenRepository.from_session(session)
        await repository.record_usage(
            organization_access_token_id, datetime.fromtimestamp(last_used_at, tz=UTC)
        )
