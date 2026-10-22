"""Continuously move ingested events from `staged_events` to `events`.

Run with `python -m polar.event.mover`. Several instances can run side by side:
each claims its rows with `FOR UPDATE SKIP LOCKED`.
"""

import asyncio
import threading
import time

import dramatiq
import logfire
import structlog

from polar import tasks  # noqa: F401
from polar.config import settings
from polar.event.repository import EventRepository
from polar.event.service import event as event_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.logfire import configure_logfire
from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.observability import STAGED_EVENTS_BACKLOG, STAGED_EVENTS_OLDEST_AGE
from polar.observability.remote_write import start_remote_write_pusher
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import create_redis
from polar.sentry import configure_sentry
from polar.worker import JobQueueManager
from polar.worker._health import _run_exposition_server, set_heartbeat_checker

log: Logger = structlog.get_logger()

BATCH_SIZE = 1000
IDLE_SLEEP_SECONDS = 0.2
ERROR_SLEEP_SECONDS = 5
HEARTBEAT_STALENESS_SECONDS = 60

_last_heartbeat: float = time.monotonic()


def _is_mover_healthy() -> bool:
    return (time.monotonic() - _last_heartbeat) < HEARTBEAT_STALENESS_SECONDS


async def _report_backlog(session: AsyncSession) -> None:
    repository = EventRepository.from_session(session)
    try:
        # A savepoint so a failed query leaves the transaction usable for the move.
        async with session.begin_nested():
            count, oldest_ingested_at = await repository.get_staged_events_backlog()
    except Exception:
        log.exception("Failed to report staged events backlog")
        return
    STAGED_EVENTS_BACKLOG.set(count)
    STAGED_EVENTS_OLDEST_AGE.set(
        (utc_now() - oldest_ingested_at).total_seconds()
        if oldest_ingested_at is not None
        else 0
    )


async def run() -> None:
    global _last_heartbeat
    engine = create_async_engine("worker")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("worker")
    broker = dramatiq.get_broker()
    last_backlog_report = 0.0
    while True:
        began = time.monotonic()
        try:
            async with JobQueueManager.open(broker, redis):
                async with sessionmaker() as session:
                    if (
                        began - last_backlog_report
                        >= settings.GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL
                    ):
                        last_backlog_report = began
                        await _report_backlog(session)
                    moved = await event_service.move_staged_events(session, BATCH_SIZE)
                    await session.commit()
            _last_heartbeat = time.monotonic()
        except Exception:
            log.exception("Failed to move staged events")
            await asyncio.sleep(ERROR_SLEEP_SECONDS)
            continue
        if moved:
            logfire.info(
                "Moved staged events",
                moved_events=moved,
                duration_ms=round((time.monotonic() - began) * 1000),
            )
        if moved < BATCH_SIZE:
            await asyncio.sleep(IDLE_SLEEP_SECONDS)


def start() -> None:
    configure_sentry()
    configure_logfire("worker")
    configure_logging(logfire=True)

    set_heartbeat_checker(_is_mover_healthy)
    threading.Thread(target=_run_exposition_server, daemon=True).start()
    start_remote_write_pusher(include_queue_metrics=False)

    asyncio.run(run())


if __name__ == "__main__":
    start()
