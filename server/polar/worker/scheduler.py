import signal
import threading
import time
from types import FrameType

import logfire
import redis
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.base import STATE_STOPPED
from apscheduler.schedulers.blocking import BlockingScheduler
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from polar import tasks
from polar.config import settings
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.postgres import create_sync_engine
from polar.redis import REDIS_RETRY, REDIS_RETRY_ON_ERRROR, SyncFailoverRedis
from polar.sentry import configure_sentry
from polar.subscription.scheduler import (
    SubscriptionJobStore,
    SubscriptionResumeJobStore,
)

from ._broker import scheduler_middleware
from ._health import _run_exposition_server, set_heartbeat_checker
from ._leader import LeaderLease

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)

HEARTBEAT_STALENESS_SECONDS = 60
# Cap the idle sleep below the staleness threshold so an idle scheduler keeps
# refreshing its heartbeat instead of reading as unhealthy.
HEARTBEAT_INTERVAL_SECONDS = 30
# Renewed on every wakeup, so at most HEARTBEAT_INTERVAL_SECONDS plus the time
# spent processing jobs apart. Only matters when an instance dies without
# releasing it: its successor waits for the lease to expire.
LEADER_LEASE_TTL_SECONDS = 90
LEADER_LEASE_KEY = "scheduler:leader"
_last_heartbeat: float = 0.0


def _bounded_wait_seconds(wait_seconds: float | None) -> float:
    if wait_seconds is None:
        return HEARTBEAT_INTERVAL_SECONDS
    return min(wait_seconds, HEARTBEAT_INTERVAL_SECONDS)


class LogfireBlockingScheduler(BlockingScheduler):
    def __init__(self, leader_lease: LeaderLease) -> None:
        super().__init__()
        self._leader_lease = leader_lease

    def _main_loop(self) -> None:
        global _last_heartbeat
        wait_seconds: float | None = 1
        while self.state != STATE_STOPPED:
            with logfire.span("Scheduler wakeup"):
                self._event.wait(_bounded_wait_seconds(wait_seconds))
                self._event.clear()
                if self.state == STATE_STOPPED:
                    break
                self._leader_lease.renew()
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

    leader_lease = LeaderLease(
        SyncFailoverRedis(
            connection_pool=redis.ConnectionPool.from_url(
                settings.redis_url,
                client_name=f"{settings.ENV.value}.scheduler",
                retry=REDIS_RETRY,
                retry_on_error=REDIS_RETRY_ON_ERRROR,
                socket_timeout=10,
                socket_connect_timeout=3,
            )
        ),
        LEADER_LEASE_KEY,
        ttl_seconds=LEADER_LEASE_TTL_SECONDS,
    )
    scheduler = LogfireBlockingScheduler(leader_lease)

    # Render sends SIGTERM to the old instance once the new one is healthy.
    # Stopping cleanly releases the lease so the new instance takes over at once
    # instead of waiting for it to expire.
    def handle_sigterm(signum: int, frame: FrameType | None) -> None:
        if scheduler.running:
            scheduler.shutdown()
        else:
            raise SystemExit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)

    scheduler.add_jobstore(MemoryJobStore(), "memory")
    scheduler.add_jobstore(SubscriptionJobStore(), "subscription")
    scheduler.add_jobstore(SubscriptionResumeJobStore(), "subscription_resume")

    for func, cron_trigger in scheduler_middleware.cron_triggers:
        scheduler.add_job(func, cron_trigger, jobstore="memory")

    # Waiting instances report healthy (no heartbeat yet), so Render can
    # finish the deploy and stop the instance currently holding the lease.
    leader_lease.acquire()
    try:
        scheduler.start()
    except KeyboardInterrupt:
        pass
    finally:
        # Also reached on LeaderLeaseLost. Wait for jobs still running in the
        # executor, so none can enqueue after another instance takes over.
        if scheduler.running:
            scheduler.shutdown()
        leader_lease.release()
        health_engine.dispose()


__all__ = ["start", "tasks"]


if __name__ == "__main__":
    start()
