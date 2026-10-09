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

from .redis_store import get_customer_identity_key
from .service import reducer_bucket as reducer_bucket_service


def _sync_debounce_key(
    reducer_id: uuid.UUID,
    bucket_start: str,
    customer_id: uuid.UUID | None,
    external_customer_id: str | None,
) -> str:
    return (
        f"reducer_bucket.sync:{reducer_id}:{bucket_start}"
        f":{get_customer_identity_key(customer_id, external_customer_id)}"
    )


@actor(
    actor_name="reducer_bucket.sync",
    priority=TaskPriority.HIGH,
    # Every run recomputes the customer's buckets, so a burst of ingestion
    # requests collapses into one run, still at least once a minute.
    debounce_key=_sync_debounce_key,
    debounce_min_threshold=10,
    debounce_max_threshold=60,
)
async def sync(
    reducer_id: Annotated[uuid.UUID, LoggableField],
    bucket_start: Annotated[str, LoggableField],
    customer_id: Annotated[uuid.UUID | None, LoggableField],
    external_customer_id: str | None,
) -> None:
    async with AsyncSessionMaker() as session:
        await reducer_bucket_service.sync(
            session,
            RedisMiddleware.get(),
            reducer_id,
            datetime.fromisoformat(bucket_start),
            customer_id,
            external_customer_id,
        )
