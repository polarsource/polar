import threading

import logfire
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.base import STATE_STOPPED
from apscheduler.schedulers.blocking import BlockingScheduler

from polar import tasks
from polar.customer_meter.scheduler import CustomerMeterJobStore
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry
from polar.subscription.scheduler import SubscriptionJobStore
from polar.worker import scheduler_middleware
from polar.worker._health import _run_exposition_server

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
    health_thread = threading.Thread(target=_run_exposition_server, daemon=True)
    health_thread.start()

    scheduler = LogfireBlockingScheduler()

    scheduler.add_jobstore(MemoryJobStore(), "memory")
    scheduler.add_jobstore(SubscriptionJobStore(), "subscription")
    scheduler.add_jobstore(CustomerMeterJobStore(), "customer_meter")

    for func, cron_trigger in scheduler_middleware.cron_triggers:
        scheduler.add_job(func, cron_trigger, jobstore="memory")

    try:
        scheduler.start()
    except KeyboardInterrupt:
        scheduler.shutdown()


__all__ = ["start", "tasks"]


if __name__ == "__main__":
    start()
