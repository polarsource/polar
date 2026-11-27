import threading

import logfire
from apscheduler.schedulers.base import STATE_STOPPED
from apscheduler.schedulers.blocking import BlockingScheduler

from polar import tasks
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.postgres import create_sync_engine
from polar.sentry import configure_sentry
from polar.subscription.scheduler import (
    SubscriptionJobStore,
    SubscriptionResumeJobStore,
    SubscriptionTrialEndedJobStore,
)

from ._broker import scheduler_middleware
from ._cron import CronJobStore
from ._health import (
    _run_exposition_server,
    is_scheduler_heartbeat_fresh,
    set_heartbeat_checker,
    touch_scheduler_heartbeat,
)

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)

# Cap the idle sleep below the staleness threshold so an idle scheduler keeps
# refreshing its heartbeat instead of reading as unhealthy.
HEARTBEAT_INTERVAL_SECONDS = 30


def _bounded_wait_seconds(wait_seconds: float | None) -> float:
    if wait_seconds is None:
        return HEARTBEAT_INTERVAL_SECONDS
    return min(wait_seconds, HEARTBEAT_INTERVAL_SECONDS)


class LogfireBlockingScheduler(BlockingScheduler):
    def _main_loop(self) -> None:
        wait_seconds: float | None = 1
        while self.state != STATE_STOPPED:
            with logfire.span("Scheduler wakeup"):
                self._event.wait(_bounded_wait_seconds(wait_seconds))
                self._event.clear()
                wait_seconds = self._process_jobs()
                touch_scheduler_heartbeat()


def start(*, serve_health: bool = False) -> None:
    touch_scheduler_heartbeat()
    engine = create_sync_engine("scheduler")

    if serve_health:
        set_heartbeat_checker(is_scheduler_heartbeat_fresh)
        health_thread = threading.Thread(target=_run_exposition_server, daemon=True)
        health_thread.start()

    scheduler = LogfireBlockingScheduler()

    scheduler.add_jobstore(
        CronJobStore(engine, scheduler_middleware.cron_triggers), "cron"
    )
    scheduler.add_jobstore(SubscriptionJobStore(), "subscription")
    scheduler.add_jobstore(SubscriptionResumeJobStore(), "subscription_resume")
    scheduler.add_jobstore(SubscriptionTrialEndedJobStore(), "subscription_trial_ended")

    try:
        scheduler.start()
    except KeyboardInterrupt:
        scheduler.shutdown()
    finally:
        engine.dispose()


__all__ = ["start", "tasks"]


if __name__ == "__main__":
    start(serve_health=True)
