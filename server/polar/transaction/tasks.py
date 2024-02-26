from polar.exceptions import PolarError
from polar.worker import AsyncSessionMaker, JobContext, interval

from .service.processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class TransactionTaskError(PolarError):
    ...


@interval(hour=0, minute=0)
async def sync_stripe_fees(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await processor_fee_transaction_service.sync_stripe_fees(session)
