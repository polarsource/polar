import uuid
from datetime import datetime

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import joinedload

from polar.event.service import event as event_service
from polar.exceptions import PolarTaskError
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Event, Meter, MeterEvent
from polar.worker import AsyncSessionMaker, TaskPriority, actor, enqueue_job


class MeterTaskError(PolarTaskError): ...


class MeterDoesNotExist(MeterTaskError):
    def __init__(self, meter_id: uuid.UUID) -> None:
        self.meter_id = meter_id
        message = f"The meter with id {meter_id} does not exist."
        super().__init__(message)


MAX_AGE_MILLISECONDS = 5 * 60 * 1000  # 5 minutes


@actor(
    actor_name="meter.enqueue_billing",
    cron_trigger=CronTrigger.from_crontab("*/15 * * * *"),
    priority=TaskPriority.LOW,
    max_age=MAX_AGE_MILLISECONDS,
)
async def meter_enqueue_billing() -> None:
    async with AsyncSessionMaker() as session:
        await meter_service.enqueue_billing(session)


@actor(actor_name="meter.billing_entries", priority=TaskPriority.LOW)
async def meter_billing_entries(meter_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = MeterRepository.from_session(session)
        meter = await repository.get_by_id(
            meter_id, options=(joinedload(Meter.last_billed_event),)
        )
        if meter is None:
            raise MeterDoesNotExist(meter_id)

        # Skip archived meters
        if meter.archived_at is not None:
            return

        await meter_service.create_billing_entries(session, meter)


BACKFILL_BATCH_SIZE = 1000
BACKFILL_INSERT_CHUNK_SIZE = 500


@actor(actor_name="meter.backfill_events", priority=TaskPriority.LOW)
async def meter_backfill_events(
    meter_id: uuid.UUID,
    last_ingested_at: str | None = None,
) -> None:
    """Backfill meter_events for a meter from historical events."""
    async with AsyncSessionMaker() as session:
        repository = MeterRepository.from_session(session)
        meter = await repository.get_by_id(meter_id)
        if meter is None:
            raise MeterDoesNotExist(meter_id)

        statement = (
            select(Event)
            .where(Event.organization_id == meter.organization_id)
            .order_by(Event.ingested_at)
            .limit(BACKFILL_BATCH_SIZE)
        )
        if last_ingested_at is not None:
            cursor_timestamp = datetime.fromisoformat(last_ingested_at)
            statement = statement.where(Event.ingested_at > cursor_timestamp)

        result = await session.execute(statement)
        events = list(result.scalars().all())

        if not events:
            return

        meter_event_rows = [
            {
                "meter_id": meter.id,
                "event_id": event.id,
                "customer_id": event.customer_id,
                "external_customer_id": event.external_customer_id,
                "organization_id": event.organization_id,
                "ingested_at": event.ingested_at,
                "timestamp": event.timestamp,
            }
            for event in events
            if event_service._event_matches_meter(event, meter)
        ]

        if meter_event_rows:
            for i in range(0, len(meter_event_rows), BACKFILL_INSERT_CHUNK_SIZE):
                chunk = meter_event_rows[i : i + BACKFILL_INSERT_CHUNK_SIZE]
                await session.execute(
                    insert(MeterEvent).values(chunk).on_conflict_do_nothing()
                )

        if len(events) == BACKFILL_BATCH_SIZE:
            last_event = events[-1]
            enqueue_job(
                "meter.backfill_events",
                meter_id,
                last_ingested_at=last_event.ingested_at.isoformat(),
            )
