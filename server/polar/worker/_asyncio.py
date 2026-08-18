import asyncio
import concurrent.futures
import logging
import os
import sys
import threading
import traceback

import dramatiq
import structlog
from dramatiq.asyncio import get_event_loop_thread
from dramatiq.middleware.asyncio import AsyncIO

from polar.config import settings
from polar.logging import Logger

log: Logger = structlog.get_logger()

HEARTBEAT_INTERVAL = 5.0
HEARTBEAT_TIMEOUT = 15.0


class _EventLoopWatchdog(threading.Thread):
    """Monitor thread that detects when the event loop stops responding.

    Schedules a callback on the event loop every HEARTBEAT_INTERVAL seconds.
    If the callback hasn't executed within HEARTBEAT_TIMEOUT seconds,
    dumps all thread stacks to help diagnose what's blocking the event loop.

    After WORKER_EVENT_LOOP_WATCHDOG_MAX_MISSES consecutive misses the process
    exits. A wedged loop cannot shut down gracefully, and dramatiq brings the
    whole worker down when a process dies, so the platform restarts it.
    """

    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        loop_thread_ident: int | None,
        *,
        heartbeat_interval: float = HEARTBEAT_INTERVAL,
        heartbeat_timeout: float = HEARTBEAT_TIMEOUT,
        max_misses: int | None = None,
    ) -> None:
        super().__init__(daemon=True, name="event-loop-watchdog")
        self.loop = loop
        self.loop_thread_ident = loop_thread_ident
        self.heartbeat_interval = heartbeat_interval
        self.heartbeat_timeout = heartbeat_timeout
        self.max_misses = (
            max_misses
            if max_misses is not None
            else settings.WORKER_EVENT_LOOP_WATCHDOG_MAX_MISSES
        )
        self._stop_event = threading.Event()
        self._heartbeat_event = threading.Event()
        self._consecutive_misses = 0
        self._exiting = False

    def run(self) -> None:
        while not self._stop_event.is_set():
            self._heartbeat_event.clear()
            try:
                self.loop.call_soon_threadsafe(self._heartbeat_event.set)
            except RuntimeError:
                break

            if not self._heartbeat_event.wait(timeout=self.heartbeat_timeout):
                self._consecutive_misses += 1
                self._dump_stacks()
                if self.max_misses > 0 and self._consecutive_misses >= self.max_misses:
                    self._exit_process()
            else:
                if self._consecutive_misses > 0:
                    total_blocked = self._consecutive_misses * (
                        self.heartbeat_interval + self.heartbeat_timeout
                    )
                    log.warning(
                        "event_loop_recovered",
                        consecutive_misses=self._consecutive_misses,
                        estimated_blocked_seconds=round(total_blocked, 1),
                    )
                self._consecutive_misses = 0

            self._stop_event.wait(timeout=self.heartbeat_interval)

    def stop(self) -> None:
        self._stop_event.set()

    def _exit_process(self) -> None:
        if self._exiting:
            return
        self._exiting = True
        log.error(
            "event_loop_unrecoverable",
            consecutive_misses=self._consecutive_misses,
            max_misses=self.max_misses,
            message="Event loop never recovered, exiting so the worker restarts.",
        )
        # os._exit skips interpreter cleanup, so flush by hand or this last
        # message never leaves the buffer dramatiq hands the worker process.
        logging.shutdown()
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)

    def _get_event_loop_stack(self) -> str:
        """Extract the stack trace of the event loop thread specifically."""
        if self.loop_thread_ident is None:
            return "<event loop thread ident unknown>"

        frame = sys._current_frames().get(self.loop_thread_ident)
        if frame is None:
            return "<no frame for event loop thread>"

        return "".join(traceback.format_stack(frame))

    def _get_thread_stacks(self) -> str:
        """Format every thread's stack.

        Deliberately pure Python. `faulthandler.dump_traceback(all_threads=True)`
        can wedge the whole process when a thread is parked in a blocking C call,
        which is exactly the situation this watchdog runs in.
        """
        names = {thread.ident: thread.name for thread in threading.enumerate()}
        sections = []
        for ident, frame in sys._current_frames().items():
            name = names.get(ident, "unknown")
            stack = "".join(traceback.format_stack(frame))
            sections.append(f"Thread {ident} ({name}):\n{stack}")
        return "\n".join(sections)

    def _get_asyncio_tasks(self) -> str:
        """Get info about asyncio tasks running on the event loop.

        Submits a coroutine to the loop to snapshot tasks. If the loop is
        blocked this will time out, which is itself useful information.
        """

        async def _snapshot_tasks() -> str:
            tasks = asyncio.all_tasks(self.loop)
            lines = []
            for task in sorted(tasks, key=lambda t: t.get_name()):
                coro = task.get_coro()
                coro_name = getattr(coro, "__qualname__", str(coro))
                state = task._state if hasattr(task, "_state") else "unknown"
                lines.append(f"  {task.get_name()} state={state} coro={coro_name}")
            return f"{len(tasks)} tasks:\n" + "\n".join(lines)

        try:
            future = asyncio.run_coroutine_threadsafe(_snapshot_tasks(), self.loop)
            return future.result(timeout=min(self.heartbeat_timeout, 2.0))
        except concurrent.futures.TimeoutError:
            return "<timed out collecting tasks — loop still blocked>"
        except Exception as e:
            return f"<error collecting tasks: {e}>"

    def _dump_stacks(self) -> None:
        # Collect fast diagnostics first — these don't touch the event loop
        event_loop_stack = self._get_event_loop_stack()
        thread_stacks = self._get_thread_stacks()

        # Collect async tasks last — this may wait up to 2s if the loop is blocked
        asyncio_tasks = self._get_asyncio_tasks()

        total_blocked = self._consecutive_misses * (
            self.heartbeat_interval + self.heartbeat_timeout
        )

        log.error(
            "event_loop_unresponsive",
            timeout_seconds=self.heartbeat_timeout,
            consecutive_misses=self._consecutive_misses,
            estimated_blocked_seconds=round(total_blocked, 1),
            event_loop_stack=event_loop_stack,
            asyncio_tasks=asyncio_tasks,
            thread_stacks=thread_stacks,
        )
        # Second copy straight to stderr: the structured field above gets
        # scrubbed and truncated, and this dump is the whole point.
        sys.stderr.write(f"{thread_stacks}\n")
        sys.stderr.flush()


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
        self._watchdog = _EventLoopWatchdog(
            event_loop_thread.loop, event_loop_thread.ident
        )
        self._watchdog.start()

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        if self._watchdog is not None:
            self._watchdog.stop()
            self._watchdog = None
        super().after_worker_shutdown(broker, worker)
