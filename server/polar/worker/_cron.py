import datetime
from collections.abc import Sequence

import dramatiq
import sentry_sdk
import structlog
from apscheduler.job import Job
from apscheduler.jobstores.base import BaseJobStore
from apscheduler.schedulers.base import BaseScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import ScheduledCron

from .repository import CronRepository

log: Logger = structlog.get_logger()

RETRY_DELAY = datetime.timedelta(seconds=5)


class CronJobStore(BaseJobStore):
    """APScheduler job store that keeps each cron's next fire time in Postgres,
    dispatched under an atomic claim on that cursor."""

    def __init__(
        self,
        engine: Engine,
        triggers: Sequence[tuple[str, CronTrigger]],
        executor: str = "default",
    ) -> None:
        self.engine = engine
        self.triggers = dict(triggers)
        self.executor = executor
        self._retry_at: datetime.datetime | None = None

    def start(self, scheduler: BaseScheduler, alias: str) -> None:
        super().start(scheduler, alias)
        now = utc_now()
        schedules = {
            job_name: (
                f"{trigger}@{trigger.timezone}",
                trigger.get_next_fire_time(None, now),
            )
            for job_name, trigger in self.triggers.items()
        }
        if not schedules:
            return
        with Session(self.engine) as session, session.begin():
            CronRepository(session).sync(schedules)

    def lookup_job(self, job_id: str) -> Job | None:
        return None

    def get_due_jobs(self, now: datetime.datetime) -> list[Job]:
        if self._retry_at is not None and now < self._retry_at:
            return []
        with Session(self.engine) as session:
            crons = CronRepository(session).get_due(list(self.triggers), now)
        return [self._job(cron) for cron in crons]

    def get_next_run_time(self) -> datetime.datetime | None:
        with Session(self.engine) as session:
            next_run_at = CronRepository(session).get_next_run_at(list(self.triggers))
        if next_run_at is None or self._retry_at is None:
            return next_run_at
        return max(next_run_at, self._retry_at)

    def get_all_jobs(self) -> list[Job]:
        with Session(self.engine) as session:
            crons = CronRepository(session).get_all(list(self.triggers))
        return [self._job(cron) for cron in crons]

    def update_job(self, job: Job) -> None:
        if self._retry_at is not None and utc_now() < self._retry_at:
            return
        # Raising here would stop the scheduler's main loop.
        try:
            with Session(self.engine) as session, session.begin():
                if not CronRepository(session).advance(job.id, job.next_run_time):
                    return
                dramatiq.get_broker().get_actor(job.id).send()
        except Exception as e:
            log.exception("scheduler.cron_failed", job_name=job.id)
            sentry_sdk.capture_exception(e)
            self._retry_at = utc_now() + RETRY_DELAY

    def add_job(self, job: Job) -> None:
        raise RuntimeError("This job store does not support managing jobs directly.")

    def remove_job(self, job_id: str) -> None:
        raise RuntimeError("This job store does not support managing jobs directly.")

    def remove_all_jobs(self) -> None:
        raise RuntimeError("This job store does not support managing jobs directly.")

    def _job(self, cron: ScheduledCron) -> Job:
        return Job(
            self._scheduler,
            **{
                **self._scheduler._job_defaults,
                "trigger": self.triggers[cron.job_name],
                "executor": self.executor,
                "func": lambda: None,
                "args": (),
                "kwargs": {},
                "id": cron.job_name,
                "name": cron.job_name,
                "next_run_time": cron.next_run_at,
                "misfire_grace_time": None,
            },
        )
