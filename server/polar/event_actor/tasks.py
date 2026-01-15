from uuid import UUID

import structlog
from sqlalchemy import or_, select

from polar.logging import Logger
from polar.models import Event
from polar.worker import AsyncSessionMaker, TaskPriority, actor, enqueue_job

from .service import event_actor_service

log: Logger = structlog.get_logger()


@actor(
    actor_name="event_actor.backfill",
    priority=TaskPriority.LOW,
    max_retries=3,
    min_backoff=60_000,
)
async def backfill_event_actors(batch_size: int = 1000) -> None:
    """
    Backfill event_actor_id for existing events that don't have one.

    Processes events in batches and schedules itself to continue
    until all events are processed.
    """
    async with AsyncSessionMaker() as session:
        # Get events without event_actor_id that have customer identifiers
        statement = (
            select(Event)
            .where(
                Event.event_actor_id.is_(None),
                or_(
                    Event.customer_id.is_not(None),
                    Event.external_customer_id.is_not(None),
                ),
            )
            .limit(batch_size)
        )
        result = await session.scalars(statement)
        events = list(result)

        if not events:
            log.info(
                "event_actor.backfill.complete", message="No more events to backfill"
            )
            return

        log.info(
            "event_actor.backfill.processing",
            batch_size=len(events),
        )

        # Group by (org_id, customer_id, external_customer_id) to minimize lookups
        event_actor_cache: dict[tuple[UUID, UUID | None, str | None], UUID] = {}

        for event in events:
            cache_key = (
                event.organization_id,
                event.customer_id,
                event.external_customer_id,
            )

            if cache_key not in event_actor_cache:
                event_actor = await event_actor_service.resolve(
                    session,
                    event.organization_id,
                    customer_id=event.customer_id,
                    external_customer_id=event.external_customer_id,
                )
                event_actor_cache[cache_key] = event_actor.id

            event.event_actor_id = event_actor_cache[cache_key]

        await session.flush()

        log.info(
            "event_actor.backfill.batch_complete",
            events_processed=len(events),
            unique_actors=len(event_actor_cache),
        )

        # Schedule next batch if we processed a full batch
        if len(events) >= batch_size:
            enqueue_job("event_actor.backfill", batch_size)
