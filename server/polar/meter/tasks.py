import uuid

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarTaskError
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Meter
from polar.worker import AsyncSessionMaker, TaskPriority, actor


class MeterTaskError(PolarTaskError): ...


class MeterDoesNotExist(MeterTaskError):
    def __init__(self, meter_id: uuid.UUID) -> None:
        self.meter_id = meter_id
        message = f"The meter with id {meter_id} does not exist."
        super().__init__(message)


MAX_AGE_MILLISECONDS = 5 * 60 * 1000  # 5 minutes


@actor(
    actor_name="meter.enqueue_billing",
    cron_trigger=CronTrigger.from_crontab("*/5 * * * *"),
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

        await meter_service.create_billing_entries(session, meter)
