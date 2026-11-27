import time


class TestIsSchedulerHealthy:
    def test_healthy_before_first_heartbeat(self) -> None:
        import polar.worker.scheduler as scheduler_module
        from polar.worker.scheduler import _is_scheduler_healthy

        original = scheduler_module._last_heartbeat
        scheduler_module._last_heartbeat = 0.0
        try:
            assert _is_scheduler_healthy() is True
        finally:
            scheduler_module._last_heartbeat = original

    def test_healthy_with_recent_heartbeat(self) -> None:
        import polar.worker.scheduler as scheduler_module
        from polar.worker.scheduler import _is_scheduler_healthy

        original = scheduler_module._last_heartbeat
        scheduler_module._last_heartbeat = time.monotonic()
        try:
            assert _is_scheduler_healthy() is True
        finally:
            scheduler_module._last_heartbeat = original

    def test_unhealthy_with_stale_heartbeat(self) -> None:
        import polar.worker.scheduler as scheduler_module
        from polar.worker.scheduler import (
            HEARTBEAT_STALENESS_SECONDS,
            _is_scheduler_healthy,
        )

        original = scheduler_module._last_heartbeat
        scheduler_module._last_heartbeat = (
            time.monotonic() - HEARTBEAT_STALENESS_SECONDS - 1
        )
        try:
            assert _is_scheduler_healthy() is False
        finally:
            scheduler_module._last_heartbeat = original


class TestBoundedWaitSeconds:
    def test_caps_long_wait_to_heartbeat_interval(self) -> None:
        from polar.worker.scheduler import (
            HEARTBEAT_INTERVAL_SECONDS,
            HEARTBEAT_STALENESS_SECONDS,
            _bounded_wait_seconds,
        )

        assert _bounded_wait_seconds(900) == HEARTBEAT_INTERVAL_SECONDS
        assert HEARTBEAT_INTERVAL_SECONDS < HEARTBEAT_STALENESS_SECONDS

    def test_caps_none_wait_to_heartbeat_interval(self) -> None:
        from polar.worker.scheduler import (
            HEARTBEAT_INTERVAL_SECONDS,
            _bounded_wait_seconds,
        )

        assert _bounded_wait_seconds(None) == HEARTBEAT_INTERVAL_SECONDS

    def test_keeps_short_wait_unchanged(self) -> None:
        from polar.worker.scheduler import _bounded_wait_seconds

        assert _bounded_wait_seconds(5) == 5
