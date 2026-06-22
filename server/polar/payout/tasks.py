import uuid

import structlog

from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.models.payout import PayoutStatus
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .repository import PayoutRepository
from .service import (
    PayoutAccountInsufficientBalance,
    PayoutAlreadyTriggered,
)
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
    # Event-only hook (fires for held payouts too); the Stripe transfer is the
    # separate `payout.transfer` task.
    async with AsyncSessionMaker() as session:
        repository = PayoutRepository(session)
        payout = await repository.get_by_id(payout_id)
        if payout is None:
            raise PayoutDoesNotExist(payout_id)


@actor(actor_name="payout.transfer", priority=TaskPriority.LOW)
async def payout_transfer(payout_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = PayoutRepository(session)
        # Lock the payout row up front: a queued transfer can race a cancel
        # (deny/block/backoffice) and would otherwise pay out a payout the ledger
        # already reversed. FOR UPDATE serializes with cancel(), which locks the
        # same row.
        payout = await repository.get_by_id(
            payout_id, options=repository.get_eager_options(), for_update=True
        )
        if payout is None:
            raise PayoutDoesNotExist(payout_id)

        await payout_service.transfer(session, payout)


@actor(
    actor_name="payout.trigger_stripe_payouts",
    cron_trigger=CronTrigger(minute=15),
    priority=TaskPriority.LOW,
)
async def trigger_stripe_payouts() -> None:
    async with AsyncSessionMaker() as session:
        await payout_service.trigger_stripe_payouts(session)


@actor(actor_name="payout.trigger_stripe_payout", priority=TaskPriority.LOW)
async def trigger_payout(
    payout_id: uuid.UUID, account_amount: int | None = None
) -> None:
    async with AsyncSessionMaker() as session:
        repository = PayoutRepository(session)
        payout = await repository.get_by_id(
            payout_id, options=repository.get_eager_options()
        )
        if payout is None:
            raise PayoutDoesNotExist(payout_id)

        try:
            await payout_service.trigger_stripe_payout(session, payout, account_amount)
        except PayoutAccountInsufficientBalance:
            # Swallow it, since it's likely the money not having arrived in the Stripe account yet.
            # The payout will be triggered again later.
            pass
        except PayoutAlreadyTriggered:
            # Swallow it, since it's likely a task that's being retried
            # while the payout has already been triggered.
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


@actor(actor_name="payout.release_held_payouts", priority=TaskPriority.LOW)
async def release_held_payouts(account_id: uuid.UUID) -> None:
    """Release held payouts for an account once its org becomes ACTIVE.

    Enqueued by ``confirm_organization_reviewed`` after a REVIEW/SNOOZED org is
    approved. Moves held payouts back to ``pending`` and kicks off the Stripe
    transfer that was held back at request time.
    """
    async with AsyncSessionMaker() as session:
        await payout_service.release_held_payouts(session, account_id)


@actor(actor_name="payout.cancel_account_payouts", priority=TaskPriority.LOW)
async def cancel_account_payouts(account_id: uuid.UUID) -> None:
    """Cancel in-flight payouts for an account leaving the review flow.

    Enqueued when an org is denied, blocked or set to offboarding. Cancels both
    ``held`` and ``pending`` payouts and returns the reserved funds (gross plus
    fees) to the available balance.
    """
    async with AsyncSessionMaker() as session:
        await payout_service.cancel_account_payouts(session, account_id)


@actor(actor_name="payout.cancel_held_payouts", priority=TaskPriority.LOW)
async def cancel_held_payouts(
    account_id: uuid.UUID, payout_account_id: uuid.UUID
) -> None:
    """Cancel only held payouts for an account when its payout account changes.

    Enqueued by ``set_payout_account`` on a swap: a held payout pins the payout
    account it was created against, so releasing it later would transfer to the
    stale account. Scoped to ``payout_account_id`` (the previous account) so a
    held payout already created against the new account isn't canceled. Pending
    payouts are left alone (their transfer may already be in flight).
    """
    async with AsyncSessionMaker() as session:
        await payout_service.cancel_account_payouts(
            session,
            account_id,
            statuses=(PayoutStatus.held,),
            payout_account_id=payout_account_id,
        )
