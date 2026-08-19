import asyncio
import threading
import time
from collections.abc import Iterator
from unittest.mock import patch

import pytest

from polar.worker._asyncio import _EventLoopWatchdog


@pytest.fixture
def event_loop_thread() -> Iterator[tuple[asyncio.AbstractEventLoop, threading.Thread]]:
    """An event loop running in a background thread."""
    loop = asyncio.new_event_loop()
    thread = threading.Thread(target=loop.run_forever, daemon=True)
    thread.start()
    yield loop, thread
    loop.call_soon_threadsafe(loop.stop)
    thread.join(timeout=2)
    loop.close()


def _block(
    loop: asyncio.AbstractEventLoop, seconds: float, name: str = "block"
) -> None:
    """Block the loop from another thread, and wait until it is really blocked."""
    started = threading.Event()

    def obviously_blocking_function() -> None:
        started.set()
        time.sleep(seconds)

    obviously_blocking_function.__name__ = name
    loop.call_soon_threadsafe(obviously_blocking_function)
    started.wait(timeout=1)


class TestEventLoopWatchdog:
    def test_healthy_loop_no_dump(
        self, event_loop_thread: tuple[asyncio.AbstractEventLoop, threading.Thread]
    ) -> None:
        loop, thread = event_loop_thread
        with patch.object(_EventLoopWatchdog, "_dump_stacks") as mock_dump:
            watchdog = _EventLoopWatchdog(
                loop,
                thread.ident,
                heartbeat_interval=0.05,
                heartbeat_timeout=0.5,
                max_misses=0,
            )
            watchdog.start()
            time.sleep(0.3)
            watchdog.stop()
            watchdog.join(timeout=2)

            mock_dump.assert_not_called()

    def test_frozen_loop_triggers_dump(
        self, event_loop_thread: tuple[asyncio.AbstractEventLoop, threading.Thread]
    ) -> None:
        loop, thread = event_loop_thread
        _block(loop, 2)

        with patch.object(_EventLoopWatchdog, "_dump_stacks") as mock_dump:
            watchdog = _EventLoopWatchdog(
                loop,
                thread.ident,
                heartbeat_interval=0.05,
                heartbeat_timeout=0.3,
                max_misses=0,
            )
            watchdog.start()
            time.sleep(0.6)
            watchdog.stop()
            watchdog.join(timeout=2)

            mock_dump.assert_called()

    def test_stops_cleanly_when_loop_closed(self) -> None:
        loop = asyncio.new_event_loop()
        thread = threading.Thread(target=loop.run_forever, daemon=True)
        thread.start()

        watchdog = _EventLoopWatchdog(
            loop,
            thread.ident,
            heartbeat_interval=0.05,
            heartbeat_timeout=0.5,
            max_misses=0,
        )
        watchdog.start()
        time.sleep(0.1)

        loop.call_soon_threadsafe(loop.stop)
        thread.join(timeout=2)
        loop.close()

        watchdog.join(timeout=2)
        assert not watchdog.is_alive()

    def test_dump_contains_blocking_function_name(
        self, event_loop_thread: tuple[asyncio.AbstractEventLoop, threading.Thread]
    ) -> None:
        loop, thread = event_loop_thread
        _block(loop, 2)

        watchdog = _EventLoopWatchdog(
            loop,
            thread.ident,
            heartbeat_interval=0.05,
            heartbeat_timeout=0.3,
            max_misses=0,
        )

        with patch("polar.worker._asyncio.log") as mock_log:
            watchdog.start()
            time.sleep(0.6)
            watchdog.stop()
            watchdog.join(timeout=2)

            mock_log.error.assert_called()
            call_kwargs = mock_log.error.call_args_list[0][1]
            assert "thread_stacks" in call_kwargs
            assert "obviously_blocking_function" in call_kwargs["thread_stacks"]
            assert "event_loop_stack" in call_kwargs
            assert "asyncio_tasks" in call_kwargs
            assert "consecutive_misses" in call_kwargs
            assert call_kwargs["consecutive_misses"] >= 1

    def test_event_loop_stack_resolves_without_thread_name(
        self, event_loop_thread: tuple[asyncio.AbstractEventLoop, threading.Thread]
    ) -> None:
        """dramatiq never names its loop thread, so the id is the only way in."""
        loop, thread = event_loop_thread
        assert thread.name != "dramatiq-asyncio"
        _block(loop, 2)

        watchdog = _EventLoopWatchdog(
            loop,
            thread.ident,
            heartbeat_interval=0.05,
            heartbeat_timeout=0.3,
            max_misses=0,
        )

        with patch("polar.worker._asyncio.log") as mock_log:
            watchdog.start()
            time.sleep(0.6)
            watchdog.stop()
            watchdog.join(timeout=2)

            event_loop_stack = mock_log.error.call_args_list[0][1]["event_loop_stack"]
            assert "not found" not in event_loop_stack
            assert "obviously_blocking_function" in event_loop_stack

    def test_dump_does_not_call_faulthandler(
        self, event_loop_thread: tuple[asyncio.AbstractEventLoop, threading.Thread]
    ) -> None:
        """faulthandler.dump_traceback(all_threads=True) can freeze the process.

        It hangs when a thread sits in a blocking C call, which is exactly when
        the watchdog runs, so this must stay pure Python.
        """
        loop, thread = event_loop_thread
        _block(loop, 2)

        watchdog = _EventLoopWatchdog(
            loop,
            thread.ident,
            heartbeat_interval=0.05,
            heartbeat_timeout=0.3,
            max_misses=0,
        )

        with patch("faulthandler.dump_traceback") as mock_faulthandler:
            watchdog.start()
            time.sleep(0.6)
            watchdog.stop()
            watchdog.join(timeout=2)

            mock_faulthandler.assert_not_called()

    def test_consecutive_misses_tracked(
        self, event_loop_thread: tuple[asyncio.AbstractEventLoop, threading.Thread]
    ) -> None:
        loop, thread = event_loop_thread
        _block(loop, 3)

        watchdog = _EventLoopWatchdog(
            loop,
            thread.ident,
            heartbeat_interval=0.05,
            heartbeat_timeout=0.3,
            max_misses=0,
        )

        with patch("polar.worker._asyncio.log") as mock_log:
            watchdog.start()
            time.sleep(1.0)
            watchdog.stop()
            watchdog.join(timeout=5)

            error_calls = [
                c
                for c in mock_log.error.call_args_list
                if c[0][0] == "event_loop_unresponsive"
            ]
            assert len(error_calls) >= 2
            assert error_calls[0][1]["consecutive_misses"] == 1
            assert error_calls[1][1]["consecutive_misses"] == 2

    def test_exits_process_after_max_misses(
        self, event_loop_thread: tuple[asyncio.AbstractEventLoop, threading.Thread]
    ) -> None:
        loop, thread = event_loop_thread
        _block(loop, 3)

        watchdog = _EventLoopWatchdog(
            loop,
            thread.ident,
            heartbeat_interval=0.05,
            heartbeat_timeout=0.3,
            max_misses=2,
        )

        with patch("polar.worker._asyncio.os._exit") as mock_exit:
            watchdog.start()
            time.sleep(1.0)
            watchdog.stop()
            watchdog.join(timeout=5)

            mock_exit.assert_called_with(1)

    def test_exits_even_when_the_dump_fails(
        self, event_loop_thread: tuple[asyncio.AbstractEventLoop, threading.Thread]
    ) -> None:
        """A broken stderr must not stop the restart.

        _dump_stacks used to run unguarded, so a write error killed the
        watchdog thread and left the stuck worker alive.
        """
        loop, thread = event_loop_thread
        _block(loop, 3)

        watchdog = _EventLoopWatchdog(
            loop,
            thread.ident,
            heartbeat_interval=0.05,
            heartbeat_timeout=0.3,
            max_misses=2,
        )

        with (
            patch.object(
                _EventLoopWatchdog, "_dump_stacks", side_effect=OSError("broken pipe")
            ),
            patch("polar.worker._asyncio.os._exit") as mock_exit,
        ):
            watchdog.start()
            time.sleep(1.0)
            watchdog.stop()
            watchdog.join(timeout=5)

            mock_exit.assert_called_with(1)

    def test_does_not_exit_when_disabled(
        self, event_loop_thread: tuple[asyncio.AbstractEventLoop, threading.Thread]
    ) -> None:
        loop, thread = event_loop_thread
        _block(loop, 3)

        watchdog = _EventLoopWatchdog(
            loop,
            thread.ident,
            heartbeat_interval=0.05,
            heartbeat_timeout=0.3,
            max_misses=0,
        )

        with patch("polar.worker._asyncio.os._exit") as mock_exit:
            watchdog.start()
            time.sleep(1.0)
            watchdog.stop()
            watchdog.join(timeout=5)

            mock_exit.assert_not_called()
