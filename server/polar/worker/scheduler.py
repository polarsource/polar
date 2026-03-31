import os
import signal

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
from ._health import _run_scheduler_exposition_server

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)


class LogfireBlockingScheduler(BlockingScheduler):
    def _main_loop(self) -> None:
        wait_seconds = 1
        while self.state != STATE_STOPPED:
            with logfire.span("Scheduler wakeup"):
                self._event.wait(wait_seconds)
                self._event.clear()
                wait_seconds = self._process_jobs()


def start() -> None:
    scheduler_pid = os.getpid()
    child_pid = os.fork()

    if child_pid == 0:
        exit_code = _run_scheduler_exposition_server(scheduler_pid)
        os._exit(exit_code)

    scheduler = LogfireBlockingScheduler()

    scheduler.add_jobstore(MemoryJobStore(), "memory")
    scheduler.add_jobstore(SubscriptionJobStore(), "subscription")

    for func, cron_trigger in scheduler_middleware.cron_triggers:
        scheduler.add_job(func, cron_trigger, jobstore="memory")

    try:
        scheduler.start()
    except KeyboardInterrupt:
        scheduler.shutdown()
    finally:
        try:
            os.kill(child_pid, signal.SIGTERM)
        except ProcessLookupError:
            pass


__all__ = ["start", "tasks"]


if __name__ == "__main__":
    start()
