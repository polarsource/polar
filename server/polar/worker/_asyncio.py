import asyncio

import dramatiq
import structlog
from dramatiq.asyncio import get_event_loop_thread
from dramatiq.middleware.asyncio import AsyncIO

from polar.logging import Logger

log: Logger = structlog.get_logger()


async def _cancel_pending_tasks() -> None:
    current = asyncio.current_task()
    tasks = [t for t in asyncio.all_tasks() if t is not current and not t.done()]
    if not tasks:
        return
    log.info("Cancelling pending asyncio tasks", count=len(tasks))
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


class GracefulAsyncIOMiddleware(AsyncIO):
    """Extends dramatiq's AsyncIO middleware to cancel pending tasks before
    stopping the event loop during shutdown.

    Without this, worker threads stuck in run_coroutine() become zombies
    after the event loop is stopped — their futures never resolve and they
    spin until TimeLimit fires (up to 60 seconds), blocking process exit.
    """

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        event_loop_thread = get_event_loop_thread()
        if event_loop_thread is None:
            return

        if event_loop_thread.loop.is_running():
            event_loop_thread.run_coroutine(_cancel_pending_tasks())

        super().after_worker_shutdown(broker, worker)
