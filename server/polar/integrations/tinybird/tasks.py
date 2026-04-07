from polar.worker import TaskQueue, actor

from .client import client
from .schemas import TinybirdEvent
from .service import DATASOURCE_EVENTS


@actor(
    actor_name="tinybird.ingest",
    queue_name=TaskQueue.TINYBIRD,
    min_backoff=30_000,
)
async def ingest(events: list[TinybirdEvent]) -> None:
    await client.ingest(DATASOURCE_EVENTS, events)
