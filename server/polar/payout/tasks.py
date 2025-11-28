import uuid

import sentry_sdk
import stripe as stripe_lib
import structlog

from polar.enums import AccountType
from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .repository import PayoutRepository
from .service import PayoutAlreadyTriggered
from .service import payout as payout_service

log: Logger = structlog.get_logger()


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

        if payout.processor == AccountType.stripe:
            await payout_service.transfer_stripe(session, payout)


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

        try:
            await payout_service.trigger_stripe_payout(session, payout)
        except PayoutAlreadyTriggered:
            # Swallow it, since it's likely a task that's being retried
            # while the payout has already been triggered.
            pass
        except stripe_lib.InvalidRequestError as e:
            # Capture exception in Sentry for debugging purposes
            sentry_sdk.capture_exception(
                e,
                extras={"payout_id": str(payout_id)},
            )
            # Do not raise an error here: we know it happens often, because Stripe
            # has many hidden rules on payout creation that we cannot control.
            pass


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
