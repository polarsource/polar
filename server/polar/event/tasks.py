import uuid
from collections.abc import Sequence
from typing import Annotated

from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import event as event_service


@actor(
    actor_name="event.ingested",
    priority=TaskPriority.LOW,
    max_retries=5,
    min_backoff=30_000,
)
async def event_ingested(
    event_ids: Annotated[Sequence[uuid.UUID], LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        await event_service.ingested(session, event_ids)
