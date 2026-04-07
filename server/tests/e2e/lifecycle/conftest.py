"""Fixtures and helpers for lifecycle E2E tests."""

import uuid

from polar.kit.db.postgres import AsyncSession
from polar.worker import JobQueueManager
from tests.e2e.infra import DrainFn, DrainResult
from tests.e2e.purchase.subscription.conftest import monthly_product  # noqa: F401


async def trigger_subscription_cycle(
    session: AsyncSession,
    drain: DrainFn,
    subscription_id: uuid.UUID,
) -> DrainResult:
    """
    Directly enqueue a subscription cycle — bypasses the scheduler picker.

    Use ``SchedulerSimulator.trigger_due_cycles()`` instead when you want to
    exercise the full scheduler query (with freezegun time control).

    This helper is kept for cases where you need to force-cycle a specific
    subscription regardless of its period dates.
    """
    await session.flush()
    jqm = JobQueueManager.set()
    jqm.enqueue_job("subscription.cycle", subscription_id)
    return await drain()
