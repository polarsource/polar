"""
Scheduler simulator for E2E tests.

Why this exists
~~~~~~~~~~~~~~~
The production ``SubscriptionJobStore`` is an APScheduler ``BaseJobStore``
subclass that uses a **sync** SQLAlchemy engine to query the database.
E2E tests use an **async** session inside an uncommitted transaction that
gets rolled back after each test.  A separate sync engine cannot see that
uncommitted data (PostgreSQL MVCC), so we cannot call the production job
store directly.

This thin wrapper bridges the gap: it calls
``SubscriptionJobStore.scheduling_statement()`` — the **production** query,
exposed as a ``@staticmethod`` — and executes it via the test's async
session.  Zero query duplication; only the execution path differs.

Usage with freezegun::

    with freeze_time("2024-02-15"):
        count = await scheduler_sim.get_due_count()
        result = await scheduler_sim.trigger_due_cycles(drain)
        assert "subscription.cycle" in result
"""

from datetime import datetime

from sqlalchemy import func

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Subscription
from polar.subscription.scheduler import SubscriptionJobStore
from polar.worker import JobQueueManager
from tests.e2e.infra.task_drain import DrainFn, DrainResult


class SchedulerSimulator:
    """
    Async bridge to ``SubscriptionJobStore.scheduling_statement()``.

    Delegates query building entirely to the production code; only execution
    and task-enqueue use test infrastructure (async session + ``JobQueueManager``).
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_due_count(self, now: datetime | None = None) -> int:
        """Return the number of subscriptions the scheduler would pick up."""
        if now is None:
            now = utc_now()

        statement = (
            SubscriptionJobStore.scheduling_statement()
            .where(Subscription.current_period_end <= now)
            .order_by(None)  # strip ORDER BY — incompatible with count()
            .with_only_columns(func.count())
        )
        result = await self._session.execute(statement)
        return result.scalar_one()

    async def trigger_due_cycles(
        self, drain: DrainFn, *, now: datetime | None = None
    ) -> DrainResult:
        """
        Pick due subscriptions and trigger their cycle — the full scheduler
        flow in one call.

        Mirrors the complete APScheduler path:
        1. ``get_due_jobs(now)`` — find subscriptions past their period end
        2. ``remove_job(job_id)`` — lock each and enqueue ``subscription.cycle``
        3. Worker executes the cycle task

        Args:
            drain: The task drain callable from the ``drain`` fixture.
            now: Reference time (defaults to ``utc_now()``).

        Returns:
            DrainResult from executing all triggered tasks.
        """
        if now is None:
            now = utc_now()

        statement = (
            SubscriptionJobStore.scheduling_statement()
            .where(Subscription.current_period_end <= now)
            .with_only_columns(Subscription.id)
        )
        result = await self._session.execute(statement)
        subscription_ids = [row[0] for row in result.all()]

        jqm = JobQueueManager.set()
        for subscription_id in subscription_ids:
            subscription = await self._session.get(Subscription, subscription_id)
            if subscription is not None:
                subscription.scheduler_locked_at = utc_now()
            jqm.enqueue_job("subscription.cycle", subscription_id=subscription_id)

        await self._session.flush()
        return await drain()
