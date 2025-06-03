from polar.exceptions import PolarTaskError
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .service.processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class TransactionTaskError(PolarTaskError): ...


@actor(
    actor_name="processor_fee.sync_stripe_fees",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
)
async def sync_stripe_fees() -> None:
    async with AsyncSessionMaker() as session:
        await processor_fee_transaction_service.sync_stripe_fees(session)
