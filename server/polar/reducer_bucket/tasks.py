import uuid
from datetime import datetime, timedelta
from typing import Annotated

from polar.observability.task_logging import LoggableField
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    RedisMiddleware,
    TaskPriority,
    actor,
)

from .service import (
    REDUCER_BUCKET_CATCH_UP_LOOKBACK,
    REDUCER_BUCKET_SYNC_LOOKBACK,
)
from .service import reducer_bucket as reducer_bucket_service


async def _schedule_syncs(lookback: timedelta) -> None:
    # Not the read replica to avoid potential lag.
    async with AsyncSessionMaker() as session:
        await reducer_bucket_service.schedule_syncs(session, lookback)


@actor(
    actor_name="reducer_bucket.schedule_syncs",
    cron_trigger=CronTrigger(minute="*"),
    priority=TaskPriority.HIGH,
)
async def schedule_syncs() -> None:
    await _schedule_syncs(REDUCER_BUCKET_SYNC_LOOKBACK)


@actor(
    actor_name="reducer_bucket.schedule_catch_up_syncs",
    cron_trigger=CronTrigger(minute=30),
    priority=TaskPriority.HIGH,
)
async def schedule_catch_up_syncs() -> None:
    await _schedule_syncs(REDUCER_BUCKET_CATCH_UP_LOOKBACK)


def _sync_organization_debounce_key(
    organization_id: uuid.UUID, bucket_starts: list[str]
) -> str:
    return f"reducer_bucket.sync_organization:{organization_id}"


@actor(
    actor_name="reducer_bucket.sync_organization",
    priority=TaskPriority.HIGH,
    # Each run enqueues all buckets still to sync, so the latest job supersedes
    # queued ones; don't delay syncs, but run at least once a minute.
    debounce_key=_sync_organization_debounce_key,
    debounce_min_threshold=0,
    debounce_max_threshold=60,
)
async def sync_organization(
    organization_id: Annotated[uuid.UUID, LoggableField],
    bucket_starts: Annotated[list[str], LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        await reducer_bucket_service.sync_organization(
            session,
            RedisMiddleware.get(),
            organization_id,
            [datetime.fromisoformat(bucket_start) for bucket_start in bucket_starts],
        )
