import datetime
import uuid

import dramatiq
import structlog
from apscheduler.job import Job
from apscheduler.jobstores.base import BaseJobStore
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import Select, select, update
from sqlalchemy.orm import Session

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Customer, Organization, Subscription
from polar.postgres import create_sync_engine


def enqueue_subscription_cycle(subscription_id: uuid.UUID) -> None:
    actor = dramatiq.get_broker().get_actor("subscription.cycle")
    actor.send(subscription_id=subscription_id)


class SubscriptionJobStore(BaseJobStore):
    """
    A custom job store for APScheduler that uses our subscription data to trigger
    cycle jobs based on subscription dates
    """

    def __init__(self, executor: str = "default") -> None:
        self.engine = create_sync_engine("scheduler")
        self.executor = executor
        self.log: Logger = structlog.get_logger()

    def shutdown(self) -> None:
        self.engine.dispose()
        return super().shutdown()

    def lookup_job(self, job_id: str) -> Job | None:
        return None

    def get_due_jobs(self, now: datetime.datetime) -> list[Job]:
        statement = self._get_base_statement().where(
            Subscription.current_period_end <= now,
        )
        jobs = self._list_jobs_from_statement(statement)
        self.log.debug("Due jobs", count=len(jobs))
        return jobs

    def get_next_run_time(self) -> datetime.datetime | None:
        statement = (
            self._get_base_statement()
            .with_only_columns(Subscription.current_period_end)
            .limit(1)
        )
        with self.engine.connect() as connection:
            result = connection.execute(statement)
            next_run_time = result.scalar_one_or_none()
            self.log.debug("Next run time", next_run_time=next_run_time)
            return next_run_time

    def get_all_jobs(self) -> list[Job]:
        statement = self._get_base_statement()
        jobs = self._list_jobs_from_statement(statement)
        self.log.debug("All jobs", count=len(jobs))
        return jobs

    def remove_job(self, job_id: str) -> None:
        subscription_id = job_id.split(":")[-1]
        statement = (
            update(Subscription)
            .where(Subscription.id == subscription_id)
            .values(scheduler_locked_at=utc_now())
        )
        with self.engine.begin() as connection:
            connection.execute(statement)

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
                    Subscription.id, Subscription.current_period_end
                ).execution_options(stream_results=True, max_row_buffer=250)
            )
            for result in results.yield_per(250):
                subscription_id, current_period_end = result._tuple()
                trigger = DateTrigger(current_period_end, datetime.UTC)
                job_kwargs = {
                    **(self._scheduler._job_defaults if self._scheduler else {}),
                    "trigger": trigger,
                    "executor": self.executor,
                    "func": enqueue_subscription_cycle,
                    "args": (subscription_id,),
                    "kwargs": {},
                    "id": f"subscriptions:cycle:{subscription_id}",
                    "name": None,
                    "next_run_time": trigger.run_date,
                    "misfire_grace_time": None,
                }
                job = Job(self._scheduler, **job_kwargs)
                jobs.append(job)
        return jobs

    def _get_base_statement(self) -> Select[tuple[Subscription]]:
        return (
            select(Subscription)
            .join(Customer, onclause=Customer.id == Subscription.customer_id)
            .join(Organization, onclause=Organization.id == Customer.organization_id)
            .where(
                Customer.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
                Subscription.scheduler_locked_at.is_(None),
                Subscription.active.is_(True),
                Subscription.current_period_end.is_not(None),
            )
            .order_by(Subscription.current_period_end.asc())
        )
