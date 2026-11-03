import threading
import time

import logfire
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.base import STATE_STOPPED
from apscheduler.schedulers.blocking import BlockingScheduler
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from polar import tasks
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.postgres import create_sync_engine
from polar.sentry import configure_sentry
from polar.subscription.scheduler import (
    SubscriptionJobStore,
    SubscriptionResumeJobStore,
)

from ._broker import scheduler_middleware
from ._health import _run_exposition_server, set_heartbeat_checker

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)

HEARTBEAT_STALENESS_SECONDS = 60
# Cap the idle sleep below the staleness threshold so an idle scheduler keeps
# refreshing its heartbeat instead of reading as unhealthy.
HEARTBEAT_INTERVAL_SECONDS = 30
_last_heartbeat: float = 0.0


def _bounded_wait_seconds(wait_seconds: float | None) -> float:
    if wait_seconds is None:
        return HEARTBEAT_INTERVAL_SECONDS
    return min(wait_seconds, HEARTBEAT_INTERVAL_SECONDS)


class LogfireBlockingScheduler(BlockingScheduler):
    def _main_loop(self) -> None:
        global _last_heartbeat
        wait_seconds: float | None = 1
        while self.state != STATE_STOPPED:
            with logfire.span("Scheduler wakeup"):
                self._event.wait(_bounded_wait_seconds(wait_seconds))
                self._event.clear()
                wait_seconds = self._process_jobs()
                _last_heartbeat = time.monotonic()


def _is_scheduler_healthy() -> bool:
    if _last_heartbeat == 0.0:
        return True
    return (time.monotonic() - _last_heartbeat) < HEARTBEAT_STALENESS_SECONDS


def start() -> None:
    health_engine = create_sync_engine("scheduler")

    def check_health() -> bool:
        try:
            with health_engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError as e:
            raise HTTPException(
                status_code=503, detail="Database is not available"
            ) from e
        return _is_scheduler_healthy()

    set_heartbeat_checker(check_health)
    health_thread = threading.Thread(target=_run_exposition_server, daemon=True)
    health_thread.start()

    scheduler = LogfireBlockingScheduler()

    scheduler.add_jobstore(MemoryJobStore(), "memory")
    scheduler.add_jobstore(SubscriptionJobStore(), "subscription")
    scheduler.add_jobstore(SubscriptionResumeJobStore(), "subscription_resume")

    for func, cron_trigger in scheduler_middleware.cron_triggers:
        scheduler.add_job(func, cron_trigger, jobstore="memory")

    try:
        scheduler.start()
    except KeyboardInterrupt:
        scheduler.shutdown()
    finally:
        health_engine.dispose()


__all__ = ["start", "tasks"]


if __name__ == "__main__":
    start()
