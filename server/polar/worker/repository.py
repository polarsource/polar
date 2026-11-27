from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, cast

from sqlalchemy import CursorResult, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from polar.models import ScheduledCron


class CronRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def sync(self, schedules: Mapping[str, tuple[str, datetime]]) -> None:
        statement = insert(ScheduledCron).values(
            [
                {"job_name": job_name, "trigger": trigger, "next_run_at": next_run_at}
                for job_name, (trigger, next_run_at) in schedules.items()
            ]
        )
        self.session.execute(
            statement.on_conflict_do_update(
                index_elements=[ScheduledCron.job_name],
                set_={
                    "trigger": statement.excluded.trigger,
                    "next_run_at": statement.excluded.next_run_at,
                },
                where=ScheduledCron.trigger != statement.excluded.trigger,
            )
        )

    def get_all(self, job_names: Sequence[str]) -> Sequence[ScheduledCron]:
        return self.session.scalars(
            select(ScheduledCron).where(ScheduledCron.job_name.in_(job_names))
        ).all()

    def get_due(
        self, job_names: Sequence[str], now: datetime
    ) -> Sequence[ScheduledCron]:
        return self.session.scalars(
            select(ScheduledCron).where(
                ScheduledCron.job_name.in_(job_names),
                ScheduledCron.next_run_at <= now,
            )
        ).all()

    def get_next_run_at(self, job_names: Sequence[str]) -> datetime | None:
        return self.session.scalar(
            select(func.min(ScheduledCron.next_run_at)).where(
                ScheduledCron.job_name.in_(job_names)
            )
        )

    def advance(self, job_name: str, next_run_at: datetime) -> bool:
        result = cast(
            CursorResult[*tuple[Any, ...]],
            self.session.execute(
                update(ScheduledCron)
                .where(
                    ScheduledCron.job_name == job_name,
                    ScheduledCron.next_run_at < next_run_at,
                )
                .values(next_run_at=next_run_at)
                .execution_options(synchronize_session=False)
            ),
        )
        return result.rowcount == 1
