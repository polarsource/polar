import uuid
from collections.abc import Sequence

from polar.worker import AsyncSessionMaker, JobContext, task

from .service import event as event_service


@task("event.ingested")
async def event_ingested(ctx: JobContext, event_ids: Sequence[uuid.UUID]) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await event_service.ingested(session, event_ids)
