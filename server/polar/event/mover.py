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
from polar.event.service import event as event_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.logfire import configure_logfire
from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.postgres import create_async_engine
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


async def run() -> None:
    global _last_heartbeat
    engine = create_async_engine("worker")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("worker")
    broker = dramatiq.get_broker()
    while True:
        began = time.monotonic()
        try:
            async with JobQueueManager.open(broker, redis):
                async with sessionmaker() as session:
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

    asyncio.run(run())


if __name__ == "__main__":
    start()
