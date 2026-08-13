"""APScheduler entrypoint.

Resident deployments run ``start()``: the scheduler blocks in its own
process, exposing a health endpoint fed by a main-loop heartbeat. Vercel
deployments instead declare the module-level ``scheduler`` as a queue
subscriber in pyproject.toml, driven by the vercel-apscheduler integration,
so ``start()`` and its heartbeat never run there.
"""

import threading
import time

import dramatiq
import logfire
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.base import STATE_STOPPED
from apscheduler.schedulers.blocking import BlockingScheduler

from polar import tasks
from polar.config import settings
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
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


def enqueue_actor(actor_name: str) -> None:
    dramatiq.get_broker().get_actor(actor_name).send()


def _create_scheduler() -> BlockingScheduler:
    scheduler = LogfireBlockingScheduler(timezone="UTC")

    # On Vercel, cron jobs must live in the default job store, which is
    # durable and serializes each job as a textual reference — hence the
    # module-level ``enqueue_actor`` keyed by actor name and the stable id.
    if settings.is_vercel():
        cron_jobstore = "default"
    else:
        scheduler.add_jobstore(MemoryJobStore(), "memory")
        cron_jobstore = "memory"

    for actor_name, cron_trigger in sorted(
        scheduler_middleware.cron_triggers, key=lambda item: item[0]
    ):
        scheduler.add_job(
            enqueue_actor,
            cron_trigger,
            args=(actor_name,),
            id=actor_name,
            replace_existing=True,
            jobstore=cron_jobstore,
        )

    scheduler.add_jobstore(SubscriptionJobStore(), "subscription")
    scheduler.add_jobstore(SubscriptionResumeJobStore(), "subscription_resume")

    return scheduler


scheduler = _create_scheduler()


def start() -> None:
    set_heartbeat_checker(_is_scheduler_healthy)
    health_thread = threading.Thread(target=_run_exposition_server, daemon=True)
    health_thread.start()

    try:
        scheduler.start()
    except KeyboardInterrupt:
        scheduler.shutdown()


__all__ = ["scheduler", "start", "tasks"]


if __name__ == "__main__":
    start()
