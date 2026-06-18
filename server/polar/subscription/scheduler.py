import datetime

import dramatiq
import structlog
from apscheduler.job import Job
from apscheduler.jobstores.base import BaseJobStore
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import ColumnElement, Select, func, select, update
from sqlalchemy.orm import Session

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Customer, Organization, Subscription
from polar.postgres import create_sync_engine

log: Logger = structlog.get_logger()


def _next_run_time() -> ColumnElement[datetime.datetime]:
    """
    The earliest pending boundary for a subscription: the billing period end, or
    the meter period end when it fires first. Postgres ``LEAST`` ignores NULLs, so
    when no meter cycle is set this collapses to ``current_period_end``.
    """
    return func.least(
        Subscription.current_period_end, Subscription.current_meter_period_end
    )


class SubscriptionJobStore(BaseJobStore):
    """
    A custom job store for APScheduler that uses our subscription data to trigger
    cycle jobs based on subscription dates
    """

    def __init__(self, executor: str = "default") -> None:
        self.engine = create_sync_engine("scheduler")
        self.executor = executor

    def shutdown(self) -> None:
        self.engine.dispose()
        return super().shutdown()

    def lookup_job(self, job_id: str) -> Job | None:
        return None

    def get_due_jobs(self, now: datetime.datetime) -> list[Job]:
        statement = self.scheduling_statement().where(
            _next_run_time() <= now,
        )
        jobs = self._list_jobs_from_statement(statement)
        log.debug("Due jobs", count=len(jobs))
        return jobs

    def get_next_run_time(self) -> datetime.datetime | None:
        statement = (
            self.scheduling_statement().with_only_columns(_next_run_time()).limit(1)
        )
        with self.engine.connect() as connection:
            result = connection.execute(statement)
            next_run_time = result.scalar_one_or_none()
            log.debug("Next run time", next_run_time=next_run_time)
            return next_run_time

    def get_all_jobs(self) -> list[Job]:
        statement = self.scheduling_statement()
        jobs = self._list_jobs_from_statement(statement)
        log.debug("All jobs", count=len(jobs))
        return jobs

    def remove_job(self, job_id: str) -> None:
        # Conditional UPDATE dedupes concurrent schedulers: losers see 0 rows.
        subscription_id = job_id.split(":")[-1]
        statement = (
            update(Subscription)
            .where(
                Subscription.id == subscription_id,
                Subscription.scheduler_locked_at.is_(None),
            )
            .values(scheduler_locked_at=utc_now())
        )
        with self.engine.begin() as connection:
            if connection.execute(statement).rowcount == 0:
                return
        actor = dramatiq.get_broker().get_actor("subscription.cycle")
        actor.send(subscription_id=subscription_id)

    def add_job(self, job: Job) -> None:
        raise RuntimeError("This job store does not support managing jobs directly.")

    def update_job(self, job: Job) -> None:
        raise RuntimeError("This job store does not support managing jobs directly.")

    def remove_all_jobs(self) -> None:
        raise RuntimeError("This job store does not support managing jobs directly.")

    def _list_jobs_from_statement(
        self, statement: Select[tuple[Subscription]]
    ) -> list[Job]:
        jobs: list[Job] = []
        with Session(self.engine) as session:
            results = session.execute(
                statement.with_only_columns(
                    Subscription.id, _next_run_time()
                ).execution_options(stream_results=True, max_row_buffer=250)
            )
            for result in results.yield_per(250):
                subscription_id, next_run_time = result._tuple()
                trigger = DateTrigger(next_run_time, datetime.UTC)
                job_kwargs = {
                    **(self._scheduler._job_defaults if self._scheduler else {}),
                    "trigger": trigger,
                    "executor": self.executor,
                    "func": lambda: None,
                    "args": (),
                    "kwargs": {},
                    "id": f"subscriptions:cycle:{subscription_id}",
                    "name": None,
                    "next_run_time": trigger.run_date,
                    "misfire_grace_time": None,
                }
                jobs.append(Job(self._scheduler, **job_kwargs))
        return jobs

    @staticmethod
    def scheduling_statement() -> Select[tuple[Subscription]]:
        """Base query for subscriptions eligible for scheduler processing.

        Returns an engine-agnostic ``Select`` — safe to execute via either
        a sync ``Session`` (production APScheduler) or an async ``AsyncSession``
        (E2E tests).
        """
        return (
            select(Subscription)
            .join(Customer, onclause=Customer.id == Subscription.customer_id)
            .join(Organization, onclause=Organization.id == Customer.organization_id)
            .where(
                Customer.is_deleted.is_(False),
                Organization.is_deleted.is_(False),
                Organization.can_renew_subscriptions.is_(True),
                Subscription.scheduler_locked_at.is_(None),
                Subscription.active.is_(True),
                Subscription.current_period_end.is_not(None),
            )
            .order_by(_next_run_time().asc())
        )
