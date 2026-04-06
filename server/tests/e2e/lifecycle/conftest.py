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
    Simulate the scheduler triggering a subscription cycle.

    Enqueues the ``subscription.cycle`` task the same way APScheduler does,
    then drains all resulting tasks (cycle → billing entries → order creation).
    """
    await session.flush()
    jqm = JobQueueManager.set()
    jqm.enqueue_job("subscription.cycle", subscription_id)
    return await drain()
