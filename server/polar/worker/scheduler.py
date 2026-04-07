import threading
import time

import logfire
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.base import STATE_STOPPED
from apscheduler.schedulers.blocking import BlockingScheduler

from polar import tasks
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry
from polar.subscription.scheduler import SubscriptionJobStore

from ._broker import scheduler_middleware
from ._health import _run_exposition_server, set_heartbeat_checker

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)

HEARTBEAT_STALENESS_SECONDS = 60
_last_heartbeat: float = 0.0


class LogfireBlockingScheduler(BlockingScheduler):
    def _main_loop(self) -> None:
        global _last_heartbeat
        wait_seconds = 1
        while self.state != STATE_STOPPED:
            with logfire.span("Scheduler wakeup"):
                self._event.wait(wait_seconds)
                self._event.clear()
                wait_seconds = self._process_jobs()
                _last_heartbeat = time.monotonic()


def _is_scheduler_healthy() -> bool:
    if _last_heartbeat == 0.0:
        return True
    return (time.monotonic() - _last_heartbeat) < HEARTBEAT_STALENESS_SECONDS


def start() -> None:
    set_heartbeat_checker(_is_scheduler_healthy)
    health_thread = threading.Thread(target=_run_exposition_server, daemon=True)
    health_thread.start()

    scheduler = LogfireBlockingScheduler()

    scheduler.add_jobstore(MemoryJobStore(), "memory")
    scheduler.add_jobstore(SubscriptionJobStore(), "subscription")

    for func, cron_trigger in scheduler_middleware.cron_triggers:
        scheduler.add_job(func, cron_trigger, jobstore="memory")

    try:
        scheduler.start()
    except KeyboardInterrupt:
        scheduler.shutdown()


__all__ = ["start", "tasks"]


if __name__ == "__main__":
    start()
