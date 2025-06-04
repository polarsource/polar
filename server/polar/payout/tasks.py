import uuid

from polar.exceptions import PolarTaskError
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .repository import PayoutRepository
from .service import payout as payout_service


class PayoutTaskError(PolarTaskError): ...


class PayoutDoesNotExist(PayoutTaskError):
    def __init__(self, payout_id: uuid.UUID) -> None:
        self.payout_id = payout_id
        message = f"The payout with id {payout_id} does not exist."
        super().__init__(message)


@actor(actor_name="payout.created", priority=TaskPriority.LOW)
async def payout_created(payout_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = PayoutRepository(session)
        payout = await repository.get_by_id(
            payout_id, options=repository.get_eager_options()
        )
        if payout is None:
            raise PayoutDoesNotExist(payout_id)


@actor(
    actor_name="payout.trigger_stripe_payouts",
    cron_trigger=CronTrigger(minute=15),
    priority=TaskPriority.LOW,
)
async def trigger_stripe_payouts() -> None:
    async with AsyncSessionMaker() as session:
        await payout_service.trigger_stripe_payouts(session)


@actor(actor_name="payout.trigger_stripe_payout", priority=TaskPriority.LOW)
async def trigger_payout(payout_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = PayoutRepository(session)
        payout = await repository.get_by_id(
            payout_id, options=repository.get_eager_options()
        )
        if payout is None:
            raise PayoutDoesNotExist(payout_id)

        await payout_service.trigger_stripe_payout(session, payout)


@actor(actor_name="payout.invoice", priority=TaskPriority.LOW)
async def order_invoice(payout_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = PayoutRepository(session)
        payout = await repository.get_by_id(
            payout_id, options=repository.get_eager_options()
        )
        if payout is None:
            raise PayoutDoesNotExist(payout_id)

        await payout_service.generate_invoice(session, payout)
