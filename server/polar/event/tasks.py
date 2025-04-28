import uuid
from collections.abc import Sequence

from polar.worker import AsyncSessionMaker, actor

from .service import event as event_service


@actor(actor_name="event.ingested")
async def event_ingested(event_ids: Sequence[uuid.UUID]) -> None:
    async with AsyncSessionMaker() as session:
        await event_service.ingested(session, event_ids)
