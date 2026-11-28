import os
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from apscheduler.schedulers.base import STATE_RUNNING, STATE_STOPPED
from pytest_mock import MockerFixture

import polar.worker._health as health_module
import polar.worker.scheduler as scheduler_module
from polar.worker._health import (
    SCHEDULER_HEARTBEAT_STALENESS_SECONDS,
    _run_exposition_server,
    is_scheduler_heartbeat_fresh,
)
from polar.worker.scheduler import HEARTBEAT_INTERVAL_SECONDS, _bounded_wait_seconds


@pytest.fixture
def stale_heartbeat(scheduler_heartbeat_path: Path) -> Path:
    scheduler_heartbeat_path.touch()
    os.utime(scheduler_heartbeat_path, (0, 0))
    return scheduler_heartbeat_path


class TestStart:
    @pytest.fixture
    def thread(self, mocker: MockerFixture) -> MagicMock:
        mocker.patch.object(scheduler_module, "create_sync_engine")
        mocker.patch.object(scheduler_module, "CronJobStore")
        mocker.patch.object(scheduler_module, "SubscriptionJobStore")
        mocker.patch.object(scheduler_module, "SubscriptionResumeJobStore")
        mocker.patch.object(scheduler_module, "SubscriptionTrialEndedJobStore")
        mocker.patch.object(scheduler_module, "LogfireBlockingScheduler")
        return mocker.patch("polar.worker.scheduler.threading.Thread")

    def test_fork_mode_leaves_health_server_to_middleware(
        self, thread: MagicMock
    ) -> None:
        scheduler_module.start()

        thread.assert_not_called()
        assert health_module._heartbeat_checker is None

    def test_standalone_serves_health(self, thread: MagicMock) -> None:
        scheduler_module.start(serve_health=True)

        thread.assert_called_once_with(target=_run_exposition_server, daemon=True)
        thread.return_value.start.assert_called_once()
        assert health_module._heartbeat_checker is is_scheduler_heartbeat_fresh

    def test_refreshes_heartbeat(
        self, thread: MagicMock, stale_heartbeat: Path
    ) -> None:
        scheduler_module.start()

        assert is_scheduler_heartbeat_fresh()


class TestMainLoop:
    def test_refreshes_heartbeat_after_processing_jobs(
        self, mocker: MockerFixture, stale_heartbeat: Path
    ) -> None:
        scheduler = scheduler_module.LogfireBlockingScheduler()
        scheduler.state = STATE_RUNNING
        mocker.patch.object(scheduler, "_event")

        def process_jobs() -> None:
            scheduler.state = STATE_STOPPED

        mocker.patch.object(scheduler, "_process_jobs", side_effect=process_jobs)

        scheduler._main_loop()

        assert is_scheduler_heartbeat_fresh()


class TestBoundedWaitSeconds:
    def test_caps_long_wait_to_heartbeat_interval(self) -> None:
        assert _bounded_wait_seconds(900) == HEARTBEAT_INTERVAL_SECONDS
        assert HEARTBEAT_INTERVAL_SECONDS < SCHEDULER_HEARTBEAT_STALENESS_SECONDS

    def test_caps_none_wait_to_heartbeat_interval(self) -> None:
        assert _bounded_wait_seconds(None) == HEARTBEAT_INTERVAL_SECONDS

    def test_keeps_short_wait_unchanged(self) -> None:
        assert _bounded_wait_seconds(5) == 5
