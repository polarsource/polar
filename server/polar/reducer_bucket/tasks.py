import uuid
from datetime import datetime
from typing import Annotated

from polar.observability.task_logging import LoggableField
from polar.worker import (
    AsyncSessionMaker,
    RedisMiddleware,
    TaskPriority,
    actor,
)

from .service import reducer_bucket as reducer_bucket_service


def _sync_debounce_key(organization_id: uuid.UUID, bucket_start: str) -> str:
    return f"reducer_bucket.sync:{organization_id}:{bucket_start}"


@actor(
    actor_name="reducer_bucket.sync",
    priority=TaskPriority.HIGH,
    # Every run recomputes the whole bucket start, so a burst of ingestion
    # requests collapses into one run, still at least once a minute.
    debounce_key=_sync_debounce_key,
    debounce_min_threshold=10,
    debounce_max_threshold=60,
)
async def sync(
    organization_id: Annotated[uuid.UUID, LoggableField],
    bucket_start: Annotated[str, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        await reducer_bucket_service.sync(
            session,
            RedisMiddleware.get(),
            organization_id,
            datetime.fromisoformat(bucket_start),
        )
