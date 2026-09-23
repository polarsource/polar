import structlog

from polar.logging import Logger
from polar.worker import TaskQueue, actor

from .client import TinybirdPayloadTooLargeError, client
from .schemas import TinybirdEvent
from .service import DATASOURCE_EVENTS

MAX_BATCH_EVENTS = 5000
log: Logger = structlog.get_logger()


async def _ingest_batch(events: list[TinybirdEvent]) -> None:
    if not events:
        return

    try:
        await client.ingest(DATASOURCE_EVENTS, events)
    except TinybirdPayloadTooLargeError as error:
        if len(events) <= 1:
            log.error(
                "tinybird.ingest.event_too_large",
                event_id=events[0].get("id"),
                payload_bytes=error.size,
                max_payload_bytes=error.max_size,
            )
            return

        midpoint = len(events) // 2
        await _ingest_batch(events[:midpoint])
        await _ingest_batch(events[midpoint:])


@actor(
    actor_name="tinybird.ingest",
    queue_name=TaskQueue.TINYBIRD,
    min_backoff=30_000,
)
async def ingest(events: list[TinybirdEvent]) -> None:
    for index in range(0, len(events), MAX_BATCH_EVENTS):
        await _ingest_batch(events[index : index + MAX_BATCH_EVENTS])
