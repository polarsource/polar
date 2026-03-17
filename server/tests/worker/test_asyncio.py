import asyncio
import ctypes
import threading
import time
from collections.abc import Iterator

import dramatiq
import pytest
from dramatiq import Worker
from dramatiq.asyncio import EventLoopThread, set_event_loop_thread
from dramatiq.brokers.stub import StubBroker
from dramatiq.threading import Interrupt

from polar.worker._asyncio import GracefulAsyncIOMiddleware


class FakeTimeLimitExceeded(Interrupt):
    pass


def raise_in_thread(thread: threading.Thread, exc_type: type[BaseException]) -> None:
    ret = ctypes.pythonapi.PyThreadState_SetAsyncExc(
        ctypes.c_ulong(thread.ident),  # type: ignore[arg-type]
        ctypes.py_object(exc_type),
    )
    if ret == 0:
        raise ValueError("Thread not found")


@pytest.fixture
def event_loop_thread() -> Iterator[EventLoopThread]:
    elt = EventLoopThread(
        dramatiq.logging.get_logger(__name__), interrupt_check_ival=0.1
    )
    elt.start(timeout=1.0)
    set_event_loop_thread(elt)
    yield elt
    if elt.loop.is_running():
        elt.stop()
    set_event_loop_thread(None)


class TestZombieThreadsWithoutFix:
    """Prove that stopping the event loop without cancelling tasks creates zombie threads."""

    def test_threads_become_zombies(self, event_loop_thread: EventLoopThread) -> None:
        ready = threading.Event()
        thread_ref: threading.Thread | None = None
        exited = threading.Event()

        async def slow_coro() -> str:
            await asyncio.sleep(300)
            return "done"

        def worker() -> None:
            nonlocal thread_ref
            thread_ref = threading.current_thread()
            ready.set()
            try:
                event_loop_thread.run_coroutine(slow_coro())
            except (RuntimeError, Interrupt):
                pass
            exited.set()

        t = threading.Thread(target=worker)
        t.start()
        ready.wait()
        time.sleep(0.2)

        # Stop event loop while coroutine is in-flight
        event_loop_thread.stop()

        # Thread should be stuck — it hasn't exited after 1 second
        assert not exited.wait(timeout=1.0), "Thread should be a zombie but it exited"
        assert t.is_alive()

        # Only TimeLimit can unstick it
        assert thread_ref is not None
        raise_in_thread(thread_ref, FakeTimeLimitExceeded)
        t.join(timeout=3.0)
        assert not t.is_alive()


class TestGracefulAsyncIOMiddleware:
    """Verify the fix: cancelling tasks before stopping prevents zombies."""

    def test_no_zombie_threads_on_shutdown(self) -> None:
        middleware = GracefulAsyncIOMiddleware()
        broker = StubBroker()
        broker.add_middleware(middleware)

        worker = Worker(broker, worker_timeout=100)
        middleware.before_worker_boot(broker, worker)

        elt = dramatiq.asyncio.get_event_loop_thread()
        assert elt is not None

        n_workers = 4
        ready_events = [threading.Event() for _ in range(n_workers)]
        exit_events = [threading.Event() for _ in range(n_workers)]
        threads: list[threading.Thread] = []

        async def slow_coro() -> str:
            await asyncio.sleep(300)
            return "done"

        def thread_worker(idx: int) -> None:
            ready_events[idx].set()
            try:
                elt.run_coroutine(slow_coro())
            except (RuntimeError, Interrupt, asyncio.CancelledError):
                pass
            exit_events[idx].set()

        for i in range(n_workers):
            t = threading.Thread(target=thread_worker, args=(i,))
            threads.append(t)
            t.start()

        for e in ready_events:
            e.wait()
        time.sleep(0.2)

        # Graceful shutdown — should cancel tasks before stopping event loop
        middleware.after_worker_shutdown(broker, worker)

        # All threads should exit within 2 seconds (no zombies)
        for i, e in enumerate(exit_events):
            assert e.wait(timeout=2.0), f"Thread {i} is a zombie"

        for t in threads:
            t.join(timeout=1.0)
            assert not t.is_alive()

        broker.close()

    def test_clean_shutdown_with_no_pending_tasks(self) -> None:
        middleware = GracefulAsyncIOMiddleware()
        broker = StubBroker()
        broker.add_middleware(middleware)

        worker = Worker(broker, worker_timeout=100)
        middleware.before_worker_boot(broker, worker)

        # Shutdown with nothing running — should not raise
        middleware.after_worker_shutdown(broker, worker)

        elt = dramatiq.asyncio.get_event_loop_thread()
        assert elt is None

        broker.close()

    def test_idempotent_shutdown(self) -> None:
        middleware = GracefulAsyncIOMiddleware()
        broker = StubBroker()
        broker.add_middleware(middleware)

        worker = Worker(broker, worker_timeout=100)
        middleware.before_worker_boot(broker, worker)
        middleware.after_worker_shutdown(broker, worker)

        # Second call should be safe (event_loop_thread is None)
        middleware.after_worker_shutdown(broker, worker)

        broker.close()
