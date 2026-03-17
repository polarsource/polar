import asyncio
import faulthandler
import sys
import tempfile
import threading

import dramatiq
import structlog
from dramatiq.asyncio import get_event_loop_thread
from dramatiq.middleware.asyncio import AsyncIO

from polar.logging import Logger

log: Logger = structlog.get_logger()

HEARTBEAT_INTERVAL = 5.0
HEARTBEAT_TIMEOUT = 15.0


class _EventLoopWatchdog(threading.Thread):
    """Monitor thread that detects when the event loop stops responding.

    Schedules a callback on the event loop every HEARTBEAT_INTERVAL seconds.
    If the callback hasn't executed within HEARTBEAT_TIMEOUT seconds,
    dumps all thread stacks to help diagnose what's blocking the event loop.
    """

    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        *,
        heartbeat_interval: float = HEARTBEAT_INTERVAL,
        heartbeat_timeout: float = HEARTBEAT_TIMEOUT,
    ) -> None:
        super().__init__(daemon=True, name="event-loop-watchdog")
        self.loop = loop
        self.heartbeat_interval = heartbeat_interval
        self.heartbeat_timeout = heartbeat_timeout
        self._stop_event = threading.Event()
        self._heartbeat_event = threading.Event()

    def run(self) -> None:
        while not self._stop_event.is_set():
            self._heartbeat_event.clear()
            try:
                self.loop.call_soon_threadsafe(self._heartbeat_event.set)
            except RuntimeError:
                break

            if not self._heartbeat_event.wait(timeout=self.heartbeat_timeout):
                self._dump_stacks()

            self._stop_event.wait(timeout=self.heartbeat_interval)

    def stop(self) -> None:
        self._stop_event.set()

    def _dump_stacks(self) -> None:
        with tempfile.TemporaryFile(mode="w+") as f:
            faulthandler.dump_traceback(file=f, all_threads=True)
            f.seek(0)
            traceback_text = f.read()

        log.error(
            "event_loop_unresponsive",
            timeout_seconds=self.heartbeat_timeout,
            thread_stacks=traceback_text,
        )
        faulthandler.dump_traceback(file=sys.stderr, all_threads=True)


class MonitoredAsyncIO(AsyncIO):
    """AsyncIO middleware with event loop health monitoring.

    Extends the standard dramatiq AsyncIO middleware to start a watchdog
    thread that monitors event loop responsiveness and dumps thread stacks
    when the event loop stops responding.
    """

    def __init__(self) -> None:
        super().__init__()
        self._watchdog: _EventLoopWatchdog | None = None

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        super().before_worker_boot(broker, worker)
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        self._watchdog = _EventLoopWatchdog(event_loop_thread.loop)
        self._watchdog.start()

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        if self._watchdog is not None:
            self._watchdog.stop()
            self._watchdog = None
        super().after_worker_shutdown(broker, worker)
