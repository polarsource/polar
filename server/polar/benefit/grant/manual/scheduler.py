import datetime
import functools
from collections.abc import Callable

import dramatiq
import sentry_sdk
import structlog
from apscheduler.job import Job
from apscheduler.jobstores.base import BaseJobStore
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import Select, select, update
from sqlalchemy.orm import Session

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Customer, ManualGrant, Organization
from polar.postgres import create_sync_engine

log: Logger = structlog.get_logger()


def _report_failures[**P, R](method: Callable[P, R]) -> Callable[P, R]:
    """Report job store query failures to Sentry, then re-raise.

    APScheduler swallows job store exceptions into a warning and retries, so
    without this a broken store degrades silently.
    """

    @functools.wraps(method)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return method(*args, **kwargs)
        except Exception as e:
            log.error("manual_grant.scheduler.job_store_failure", exc_info=True)
            sentry_sdk.capture_exception(e)
            raise

    return wrapper


class ManualGrantExpiryJobStore(BaseJobStore):
    """APScheduler job store that triggers ``manual_grant.revoke_expired`` at
    each manual grant's ``expires_at``, dispatched under an atomic
    ``scheduler_locked_at`` claim.

    Modeled on ``polar.subscription.scheduler._SubscriptionScheduleJobStore``.
    Expiry is one-shot, so the claim is never cleared: a locked row is a
    dispatched row, and it permanently leaves the scheduling statement.
    """

    job_id_prefix = "manual_grants:revoke_expired"
    actor_name = "manual_grant.revoke_expired"

    def __init__(self, executor: str = "default") -> None:
        self.engine = create_sync_engine("scheduler")
        self.executor = executor

    def shutdown(self) -> None:
        self.engine.dispose()
        return super().shutdown()

    def lookup_job(self, job_id: str) -> Job | None:
        return None

    @_report_failures
    def get_due_jobs(self, now: datetime.datetime) -> list[Job]:
        statement = self.scheduling_statement().where(ManualGrant.expires_at <= now)
        jobs = self._list_jobs_from_statement(statement)
        log.debug("Due jobs", count=len(jobs), store=self.job_id_prefix)
        return jobs

    @_report_failures
    def get_next_run_time(self) -> datetime.datetime | None:
        statement = (
            self.scheduling_statement()
            .with_only_columns(ManualGrant.expires_at)
            .limit(1)
        )
        with self.engine.connect() as connection:
            result = connection.execute(statement)
            next_run_time = result.scalar_one_or_none()
            log.debug(
                "Next run time", next_run_time=next_run_time, store=self.job_id_prefix
            )
            return next_run_time

    @_report_failures
    def get_all_jobs(self) -> list[Job]:
        statement = self.scheduling_statement()
        jobs = self._list_jobs_from_statement(statement)
        log.debug("All jobs", count=len(jobs), store=self.job_id_prefix)
        return jobs

    @_report_failures
    def remove_job(self, job_id: str) -> None:
        # Conditional UPDATE dedupes concurrent schedulers: losers see 0 rows.
        manual_grant_id = job_id.split(":")[-1]
        statement = (
            update(ManualGrant)
            .where(
                ManualGrant.id == manual_grant_id,
                ManualGrant.scheduler_locked_at.is_(None),
            )
            .values(scheduler_locked_at=utc_now())
        )
        with self.engine.begin() as connection:
            if connection.execute(statement).rowcount == 0:
                return
        actor = dramatiq.get_broker().get_actor(self.actor_name)
        actor.send(manual_grant_id=manual_grant_id)

    def add_job(self, job: Job) -> None:
        raise RuntimeError("This job store does not support managing jobs directly.")

    def update_job(self, job: Job) -> None:
        raise RuntimeError("This job store does not support managing jobs directly.")

    def remove_all_jobs(self) -> None:
        raise RuntimeError("This job store does not support managing jobs directly.")

    def _list_jobs_from_statement(
        self, statement: Select[tuple[ManualGrant]]
    ) -> list[Job]:
        jobs: list[Job] = []
        with Session(self.engine) as session:
            results = session.execute(
                statement.with_only_columns(
                    ManualGrant.id, ManualGrant.expires_at
                ).execution_options(stream_results=True, max_row_buffer=250)
            )
            for result in results.yield_per(250):
                manual_grant_id, run_date = result._tuple()
                trigger = DateTrigger(run_date, datetime.UTC)
                job_kwargs = {
                    **(self._scheduler._job_defaults if self._scheduler else {}),
                    "trigger": trigger,
                    "executor": self.executor,
                    "func": lambda: None,
                    "args": (),
                    "kwargs": {},
                    "id": f"{self.job_id_prefix}:{manual_grant_id}",
                    "name": None,
                    "next_run_time": trigger.run_date,
                    "misfire_grace_time": None,
                }
                jobs.append(Job(self._scheduler, **job_kwargs))
        return jobs

    @staticmethod
    def scheduling_statement() -> Select[tuple[ManualGrant]]:
        """Base query for manual grants eligible for expiry scheduling.

        Returns an engine-agnostic ``Select`` — safe to execute via either
        a sync ``Session`` (production APScheduler) or an async ``AsyncSession``
        (E2E tests).
        """
        return (
            select(ManualGrant)
            .join(Customer, onclause=Customer.id == ManualGrant.customer_id)
            .join(Organization, onclause=Organization.id == Customer.organization_id)
            .where(
                Customer.is_deleted.is_(False),
                Organization.is_deleted.is_(False),
                ManualGrant.is_deleted.is_(False),
                ManualGrant.scheduler_locked_at.is_(None),
                ManualGrant.expires_at.is_not(None),
            )
            .order_by(ManualGrant.expires_at.asc())
        )
