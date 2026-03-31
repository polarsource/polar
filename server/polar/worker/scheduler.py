import logfire
import redis as sync_redis
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.base import STATE_STOPPED
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

from polar import tasks
from polar.config import settings
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry
from polar.subscription.scheduler import SubscriptionJobStore

from ._broker import scheduler_middleware
from ._health import SCHEDULER_HEARTBEAT_KEY, SCHEDULER_HEARTBEAT_TTL_SECONDS

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


SCHEDULER_HEARTBEAT_INTERVAL_SECONDS = 30


def _update_heartbeat() -> None:
    r = sync_redis.Redis.from_url(settings.redis_url)
    try:
        r.set(SCHEDULER_HEARTBEAT_KEY, "1", ex=SCHEDULER_HEARTBEAT_TTL_SECONDS)
    finally:
        r.close()


def start() -> None:
    _update_heartbeat()

    scheduler = LogfireBlockingScheduler()

    scheduler.add_jobstore(MemoryJobStore(), "memory")
    scheduler.add_jobstore(SubscriptionJobStore(), "subscription")

    for func, cron_trigger in scheduler_middleware.cron_triggers:
        scheduler.add_job(func, cron_trigger, jobstore="memory")

    scheduler.add_job(
        _update_heartbeat,
        IntervalTrigger(seconds=SCHEDULER_HEARTBEAT_INTERVAL_SECONDS),
        jobstore="memory",
    )

    try:
        scheduler.start()
    except KeyboardInterrupt:
        scheduler.shutdown()


__all__ = ["start", "tasks"]


if __name__ == "__main__":
    start()
