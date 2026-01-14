import datetime
import uuid
from operator import or_

import dramatiq
import structlog
from apscheduler.job import Job
from apscheduler.jobstores.base import BaseJobStore
from apscheduler.triggers.date import DateTrigger
from sqlalchemy import Select, case, func, select, update
from sqlalchemy.orm import Session

from polar.config import settings
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Customer
from polar.postgres import create_sync_engine


def enqueue_update_customer(
    customer_id: uuid.UUID, meters_dirtied_at: datetime.datetime | None = None
) -> None:
    actor = dramatiq.get_broker().get_actor("customer_meter.update_customer")
    actor.send(customer_id=customer_id, meters_dirtied_at=meters_dirtied_at)


ORG_ID = "b3caa8b6-a64b-4c7c-94ad-03f70cc06841"
ORG_TIMEDELTA = datetime.timedelta(minutes=2)


class CustomerMeterJobStore(BaseJobStore):
    """
    A custom job store for APScheduler that creates jobs for customers that
    have a meters_dirtied_at set for more than a given threshold.
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
        statement = (
            select(Customer)
            .where(
                Customer.deleted_at.is_(None),
                Customer.meters_dirtied_at.is_not(None),
                or_(
                    Customer.meters_dirtied_at
                    < case(
                        (Customer.organization_id == ORG_ID, now - ORG_TIMEDELTA),
                        else_=now
                        - settings.CUSTOMER_METER_UPDATE_DEBOUNCE_MIN_THRESHOLD,
                    ),
                    Customer.meters_dirtied_at
                    > func.coalesce(Customer.meters_updated_at, Customer.created_at)
                    + settings.CUSTOMER_METER_UPDATE_DEBOUNCE_MAX_THRESHOLD,
                ),
            )
            .order_by(Customer.meters_dirtied_at.asc())
        )
        jobs = self._list_jobs_from_statement(statement)
        self.log.debug("Due jobs", count=len(jobs))
        return jobs

    def get_next_run_time(self) -> datetime.datetime:
        return utc_now() + settings.CUSTOMER_METER_UPDATE_DEBOUNCE_MIN_THRESHOLD

    def get_all_jobs(self) -> list[Job]:
        now = utc_now()
        statement = (
            select(Customer)
            .where(
                Customer.deleted_at.is_(None),
                or_(
                    Customer.meters_dirtied_at
                    < case(
                        (Customer.organization_id == ORG_ID, now - ORG_TIMEDELTA),
                        else_=now
                        - settings.CUSTOMER_METER_UPDATE_DEBOUNCE_MIN_THRESHOLD,
                    ),
                    Customer.meters_dirtied_at
                    > func.coalesce(Customer.meters_updated_at, Customer.created_at)
                    + settings.CUSTOMER_METER_UPDATE_DEBOUNCE_MAX_THRESHOLD,
                ),
            )
            .order_by(Customer.meters_dirtied_at.asc())
        )
        jobs = self._list_jobs_from_statement(statement)
        self.log.debug("All jobs", count=len(jobs))
        return jobs

    def remove_job(self, job_id: str) -> None:
        customer_id = job_id.split(":")[-1]
        statement = (
            update(Customer)
            .where(Customer.id == customer_id)
            .values(meters_dirtied_at=None)
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
        self, statement: Select[tuple[Customer]]
    ) -> list[Job]:
        jobs: list[Job] = []
        with Session(self.engine) as session:
            results = session.execute(
                statement.with_only_columns(
                    Customer.id, Customer.meters_dirtied_at
                ).execution_options(stream_results=True, max_row_buffer=250)
            )
            for result in results.yield_per(250):
                customer_id, meters_dirtied_at = result._tuple()
                trigger = DateTrigger(meters_dirtied_at, datetime.UTC)
                meters_dirtied = (
                    meters_dirtied_at.isoformat() if meters_dirtied_at else None
                )
                job_kwargs = {
                    **(self._scheduler._job_defaults if self._scheduler else {}),
                    "trigger": trigger,
                    "executor": self.executor,
                    "func": enqueue_update_customer,
                    "args": (customer_id, meters_dirtied),
                    "kwargs": {},
                    "id": f"customers:meter_update:{customer_id}",
                    "name": None,
                    "next_run_time": trigger.run_date,
                    "misfire_grace_time": None,
                }
                job = Job(self._scheduler, **job_kwargs)
                jobs.append(job)
        return jobs
