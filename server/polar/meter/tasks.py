import uuid

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarTaskError
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Meter
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task


class MeterTaskError(PolarTaskError): ...


class MeterDoesNotExist(MeterTaskError):
    def __init__(self, meter_id: uuid.UUID) -> None:
        self.meter_id = meter_id
        message = f"The meter with id {meter_id} does not exist."
        super().__init__(message)


@task("meter.enqueue_billing", cron_trigger=CronTrigger.from_crontab("*/5 * * * *"))
async def meter_enqueue_billing(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await meter_service.enqueue_billing(session)


@task("meter.billing_entries")
async def meter_billing_entries(
    ctx: JobContext, meter_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        repository = MeterRepository.from_session(session)
        meter = await repository.get_by_id(
            meter_id, options=(joinedload(Meter.last_billed_event),)
        )
        if meter is None:
            raise MeterDoesNotExist(meter_id)

        await meter_service.create_billing_entries(session, meter)
