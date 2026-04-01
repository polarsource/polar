import contextlib
from collections.abc import AsyncIterator, Sequence
from unittest.mock import patch
from uuid import UUID

import dramatiq
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models.benefit_grant import BenefitGrant
from polar.models.billing_entry import BillingEntry, BillingEntryType
from polar.worker._enqueue import JobQueueManager, _job_queue_manager


async def drain_jobs(session: AsyncSession) -> None:
    """Execute all enqueued background jobs inline using the test session.

    Recursively processes sub-jobs enqueued by the executed jobs.
    Actors that fail (e.g. email sending) are silently skipped — the test
    should assert on final database state to catch missing side-effects.
    """
    broker = dramatiq.get_broker()
    manager = _job_queue_manager.get(None)
    if not manager:
        return

    async def _noop() -> None:
        pass

    # Prevent actors' AsyncSessionMaker from committing/closing/rolling back
    # the shared test session.
    session.commit = session.flush  # type: ignore[method-assign]
    session.close = _noop  # type: ignore[method-assign]
    session.rollback = _noop  # type: ignore[method-assign]

    # Prevent nested actor calls from replacing/flushing/closing the test JQM.
    # The original open() creates a new JQM, flushes it to Redis on exit,
    # and sets the context var to None. Our passthrough keeps the test JQM alive.
    @classmethod  # type: ignore[misc]
    @contextlib.asynccontextmanager
    async def _passthrough_open(
        cls: type[JobQueueManager],
        _broker: dramatiq.Broker,
        _redis: object,
    ) -> AsyncIterator[JobQueueManager]:
        yield manager

    with patch.object(JobQueueManager, "open", _passthrough_open):
        try:
            while manager._enqueued_jobs:
                jobs = list(manager._enqueued_jobs)
                manager._enqueued_jobs = []
                manager._ingested_events = []

                for actor_name, args, kwargs, _delay in jobs:
                    raw_fn = broker.get_actor(actor_name).fn
                    fn = getattr(raw_fn, "__wrapped__", raw_fn)
                    try:
                        await fn(*args, **kwargs)
                    except Exception:
                        pass
        finally:
            del session.commit
            del session.close
            del session.rollback


async def get_benefit_grants(
    session: AsyncSession, customer_id: UUID, benefit_id: UUID
) -> Sequence[BenefitGrant]:
    result = await session.execute(
        select(BenefitGrant).where(
            BenefitGrant.customer_id == customer_id,
            BenefitGrant.benefit_id == benefit_id,
        )
    )
    return result.scalars().all()


async def get_cycle_billing_entries(
    session: AsyncSession, subscription_id: UUID
) -> Sequence[BillingEntry]:
    result = await session.execute(
        select(BillingEntry)
        .where(
            BillingEntry.subscription_id == subscription_id,
            BillingEntry.type == BillingEntryType.cycle,
        )
        .order_by(BillingEntry.created_at)
    )
    return result.scalars().all()
