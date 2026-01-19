from collections.abc import Iterator

import dramatiq
import pytest
import redis
from dramatiq.brokers.stub import StubBroker
from fakeredis import FakeStrictRedis
from pytest_mock import MockerFixture

from polar.worker._debounce import DebounceMiddleware


@pytest.fixture
def fake_redis() -> FakeStrictRedis:
    """Create a FakeRedis instance for testing."""
    return FakeStrictRedis(decode_responses=False)


@pytest.fixture
def stub_broker_with_debounce(fake_redis: FakeStrictRedis) -> Iterator[StubBroker]:
    """Create a StubBroker with DebounceMiddleware for testing."""
    broker = StubBroker()
    # Create a fake connection pool that returns our fake redis
    pool = redis.ConnectionPool()
    middleware = DebounceMiddleware(pool)
    middleware._redis = fake_redis
    broker.add_middleware(middleware)
    broker.emit_after("process_boot")
    yield broker
    broker.close()


class TestDebounceMiddleware:
    """Test DebounceMiddleware memory management."""

    @pytest.fixture
    def broker(self, fake_redis: FakeStrictRedis) -> StubBroker:
        """Create a simple StubBroker for direct testing."""
        broker = StubBroker()
        pool = redis.ConnectionPool()
        middleware = DebounceMiddleware(pool)
        middleware._redis = fake_redis
        broker.add_middleware(middleware)
        return broker

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

    def test_after_skip_message_cleans_up_ephemeral_options(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
        mocker: MockerFixture,
    ) -> None:
        """Test that after_skip_message removes ephemeral options to prevent memory leak."""
        mock_delay = mocker.patch("polar.worker._debounce.TASK_DEBOUNCE_DELAY")

        middleware = next(
            m for m in broker.middleware if isinstance(m, DebounceMiddleware)
        )

        # Simulate message options that would be set by before_process_message
        message.options["debounce_key"] = "test_debounce_key"
        message.options["debounce_enqueue_timestamp"] = 1234567890
        message.options["debounce_max_threshold_execution"] = True

        # Verify options are present
        assert "debounce_enqueue_timestamp" in message.options
        assert "debounce_max_threshold_execution" in message.options

        # Call after_skip_message
        middleware.after_skip_message(broker, message)

        # Verify ephemeral options are removed
        assert "debounce_enqueue_timestamp" not in message.options
        assert "debounce_max_threshold_execution" not in message.options
        # Verify the debounce_key itself is preserved
        assert message.options["debounce_key"] == "test_debounce_key"

        # Verify metrics were recorded
        mock_delay.labels.assert_called_once_with(
            queue="test_queue", task_name="test_actor"
        )

    def test_after_skip_message_handles_missing_options(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
    ) -> None:
        """Test that after_skip_message gracefully handles missing options."""
        middleware = next(
            m for m in broker.middleware if isinstance(m, DebounceMiddleware)
        )

        message.options["debounce_key"] = "test_debounce_key"

        # Should not raise an error
        middleware.after_skip_message(broker, message)

    def test_after_skip_message_does_nothing_without_debounce_key(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
    ) -> None:
        """Test that after_skip_message returns early if debounce_key is not set."""
        middleware = next(
            m for m in broker.middleware if isinstance(m, DebounceMiddleware)
        )

        message.options["debounce_enqueue_timestamp"] = 1234567890

        # Should return early without removing options
        middleware.after_skip_message(broker, message)

        # Option should still be present since there's no debounce_key
        assert "debounce_enqueue_timestamp" in message.options

    def test_after_process_message_cleans_up_ephemeral_options(
        self,
        broker: StubBroker,
        message: dramatiq.MessageProxy,
        mocker: MockerFixture,
    ) -> None:
        """Test that after_process_message also removes ephemeral options."""
        mock_delay = mocker.patch("polar.worker._debounce.TASK_DEBOUNCE_DELAY")

        middleware = next(
            m for m in broker.middleware if isinstance(m, DebounceMiddleware)
        )

        # Simulate message options
        message.options["debounce_key"] = "test_debounce_key"
        message.options["debounce_enqueue_timestamp"] = 1234567890

        # Call after_process_message
        middleware.after_process_message(broker, message, result=None, exception=None)

        # Verify ephemeral options are removed
        assert "debounce_enqueue_timestamp" not in message.options
        # Verify metrics were recorded
        mock_delay.labels.assert_called_once_with(
            queue="test_queue", task_name="test_actor"
        )
