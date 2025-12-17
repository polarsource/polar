from collections.abc import Iterator
from pathlib import Path

import dramatiq
import pytest
from dramatiq import Worker
from dramatiq.brokers.stub import StubBroker
from pytest_mock import MockerFixture

from polar.worker._metrics import PrometheusMiddleware


@pytest.fixture
def prometheus_dir(tmp_path: Path) -> Path:
    """Create a temporary prometheus multiprocess directory."""
    prom_dir = tmp_path / "prometheus_multiproc"
    prom_dir.mkdir()
    return prom_dir


@pytest.fixture
def stub_broker() -> Iterator[StubBroker]:
    """Create a StubBroker with PrometheusMiddleware for testing."""
    broker = StubBroker()
    broker.add_middleware(PrometheusMiddleware())
    broker.emit_after("process_boot")
    yield broker
    broker.close()


@pytest.fixture
def stub_worker(stub_broker: StubBroker) -> Iterator[Worker]:
    """Create a worker for processing messages."""
    worker = Worker(stub_broker, worker_timeout=100)
    worker.start()
    yield worker
    worker.stop()


class TestPrometheusMiddlewareWithStubBroker:
    def test_middleware_integrated_with_broker(
        self, stub_broker: StubBroker, stub_worker: Worker, mocker: MockerFixture
    ) -> None:
        """Test that middleware is properly integrated with the broker."""
        mock_executions = mocker.patch("polar.worker._metrics.TASK_EXECUTIONS")
        mock_duration = mocker.patch("polar.worker._metrics.TASK_DURATION")

        @dramatiq.actor(broker=stub_broker)
        def simple_task() -> str:
            return "done"

        simple_task.send()
        stub_broker.join(simple_task.queue_name)
        stub_worker.join()

        # Verify metrics were recorded
        mock_executions.labels.assert_called_with(
            task_name="simple_task", status="success"
        )
        mock_duration.labels.assert_called_with(task_name="simple_task")

    def test_middleware_records_failure_on_exception(
        self, stub_broker: StubBroker, stub_worker: Worker, mocker: MockerFixture
    ) -> None:
        """Test that middleware records failure when task raises exception."""
        mock_executions = mocker.patch("polar.worker._metrics.TASK_EXECUTIONS")

        @dramatiq.actor(broker=stub_broker, max_retries=0)
        def failing_task() -> None:
            raise ValueError("Task failed")

        failing_task.send()

        with pytest.raises(ValueError, match="Task failed"):
            stub_broker.join(failing_task.queue_name)
        stub_worker.join()

        mock_executions.labels.assert_called_with(
            task_name="failing_task", status="failure"
        )

    def test_middleware_records_retries(
        self, stub_broker: StubBroker, stub_worker: Worker, mocker: MockerFixture
    ) -> None:
        """Test that middleware records retry count."""
        mock_retries = mocker.patch("polar.worker._metrics.TASK_RETRIES")
        mock_executions = mocker.patch("polar.worker._metrics.TASK_EXECUTIONS")

        call_count = 0

        @dramatiq.actor(broker=stub_broker, max_retries=2, min_backoff=1, max_backoff=1)
        def retrying_task() -> None:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError("Retry me")

        retrying_task.send()
        stub_broker.join(retrying_task.queue_name)
        stub_worker.join()

        # Should have recorded retries (2 retries after initial failure)
        assert mock_retries.labels.call_count == 2
        # Final call should be success
        mock_executions.labels.assert_called_with(
            task_name="retrying_task", status="success"
        )

    def test_middleware_measures_duration(
        self, stub_broker: StubBroker, stub_worker: Worker, mocker: MockerFixture
    ) -> None:
        """Test that middleware measures task duration."""
        mock_duration = mocker.patch("polar.worker._metrics.TASK_DURATION")

        import time

        @dramatiq.actor(broker=stub_broker)
        def slow_task() -> None:
            time.sleep(0.05)  # 50ms

        slow_task.send()
        stub_broker.join(slow_task.queue_name)
        stub_worker.join()

        # Verify observe was called with a duration
        mock_duration.labels.assert_called_with(task_name="slow_task")
        observe_call = mock_duration.labels().observe.call_args
        duration = observe_call[0][0]
        assert duration >= 0.05  # At least 50ms


class TestPrometheusMiddlewareDirectCalls:
    """Test middleware methods directly for edge cases."""

    @pytest.fixture
    def broker(self) -> StubBroker:
        """Create a simple StubBroker without middleware for direct testing."""
        return StubBroker()

    @pytest.fixture
    def message(self) -> dramatiq.MessageProxy:
        """Create a test Dramatiq message."""
        return dramatiq.MessageProxy(
            dramatiq.Message(
                queue_name="test_queue",
                actor_name="test_actor",
                args=(),
                kwargs={},
                options={},
            )
        )

    def test_before_worker_boot_clears_directory(
        self,
        broker: StubBroker,
        prometheus_dir: Path,
        mocker: MockerFixture,
    ) -> None:
        """Test that before_worker_boot clears the prometheus directory."""
        # Create some stale files
        stale_file = prometheus_dir / "stale_metrics.db"
        stale_file.write_text("stale data")
        assert stale_file.exists()

        mocker.patch(
            "polar.worker._metrics.settings.WORKER_PROMETHEUS_DIR",
            prometheus_dir,
        )

        middleware = PrometheusMiddleware()
        worker = Worker(broker, worker_timeout=100)
        middleware.before_worker_boot(broker, worker)

        # Directory should exist but stale file should be gone
        assert prometheus_dir.exists()
        assert not stale_file.exists()

    def test_before_worker_boot_handles_missing_directory(
        self,
        broker: StubBroker,
        tmp_path: Path,
        mocker: MockerFixture,
    ) -> None:
        """Test that before_worker_boot handles non-existent directory gracefully."""
        prometheus_dir = tmp_path / "non_existent"
        mocker.patch(
            "polar.worker._metrics.settings.WORKER_PROMETHEUS_DIR",
            prometheus_dir,
        )

        middleware = PrometheusMiddleware()
        worker = Worker(broker, worker_timeout=100)
        # Should not raise even if directory doesn't exist
        middleware.before_worker_boot(broker, worker)

    def test_before_process_message_sets_start_time(
        self, broker: StubBroker, message: dramatiq.MessageProxy
    ) -> None:
        """Test that before_process_message records the start time."""
        middleware = PrometheusMiddleware()

        assert "prometheus_start_time" not in message.options
        middleware.before_process_message(broker, message)
        assert "prometheus_start_time" in message.options
        assert isinstance(message.options["prometheus_start_time"], float)

    def test_before_process_message_increments_retries(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
        mocker: MockerFixture,
    ) -> None:
        """Test that before_process_message increments retry counter on retries."""
        mock_retries = mocker.patch("polar.worker._metrics.TASK_RETRIES")

        message.options["retries"] = 2
        middleware = PrometheusMiddleware()
        middleware.before_process_message(broker, message)

        mock_retries.labels.assert_called_once_with(task_name="test_actor")
        mock_retries.labels().inc.assert_called_once()

    def test_before_process_message_no_retry_on_first_attempt(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
        mocker: MockerFixture,
    ) -> None:
        """Test that before_process_message doesn't increment retries on first attempt."""
        mock_retries = mocker.patch("polar.worker._metrics.TASK_RETRIES")

        message.options["retries"] = 0
        middleware = PrometheusMiddleware()
        middleware.before_process_message(broker, message)

        mock_retries.labels.assert_not_called()

    def test_after_process_message_records_success(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
        mocker: MockerFixture,
    ) -> None:
        """Test that after_process_message records success metrics."""
        mock_duration = mocker.patch("polar.worker._metrics.TASK_DURATION")
        mock_executions = mocker.patch("polar.worker._metrics.TASK_EXECUTIONS")

        message.options["prometheus_start_time"] = 0.0
        mocker.patch("time.perf_counter", return_value=1.5)

        middleware = PrometheusMiddleware()
        middleware.after_process_message(broker, message, result="ok", exception=None)

        mock_duration.labels.assert_called_with(task_name="test_actor")
        mock_duration.labels().observe.assert_called_once()

        mock_executions.labels.assert_called_with(
            task_name="test_actor", status="success"
        )
        mock_executions.labels().inc.assert_called_once()

    def test_after_process_message_records_failure(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
        mocker: MockerFixture,
    ) -> None:
        """Test that after_process_message records failure metrics."""
        mock_executions = mocker.patch("polar.worker._metrics.TASK_EXECUTIONS")
        mocker.patch("polar.worker._metrics.TASK_DURATION")

        message.options["prometheus_start_time"] = 0.0

        middleware = PrometheusMiddleware()
        middleware.after_process_message(
            broker, message, result=None, exception=Exception("test error")
        )

        mock_executions.labels.assert_called_with(
            task_name="test_actor", status="failure"
        )
        mock_executions.labels().inc.assert_called_once()

    def test_after_process_message_removes_start_time(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
        mocker: MockerFixture,
    ) -> None:
        """Test that after_process_message removes start time from options."""
        mocker.patch("polar.worker._metrics.TASK_DURATION")
        mocker.patch("polar.worker._metrics.TASK_EXECUTIONS")

        message.options["prometheus_start_time"] = 0.0

        middleware = PrometheusMiddleware()
        middleware.after_process_message(broker, message, result="ok", exception=None)

        assert "prometheus_start_time" not in message.options

    def test_after_skip_message_records_skipped(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
        mocker: MockerFixture,
    ) -> None:
        """Test that after_skip_message records skipped status."""
        mock_executions = mocker.patch("polar.worker._metrics.TASK_EXECUTIONS")
        mocker.patch("polar.worker._metrics.TASK_DURATION")

        message.options["prometheus_start_time"] = 0.0

        middleware = PrometheusMiddleware()
        middleware.after_skip_message(broker, message)

        mock_executions.labels.assert_called_with(
            task_name="test_actor", status="skipped"
        )
        mock_executions.labels().inc.assert_called_once()
