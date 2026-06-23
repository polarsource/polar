import math

from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.config import settings
from polar.worker import _sqs
from polar.worker._runner import compute_retry_backoff


def _jitter_bounds(min_backoff_ms: int, retries: int) -> tuple[int, int]:
    base_ms = min_backoff_ms * (2**retries)
    return math.ceil(base_ms / 1000), math.ceil(base_ms * 2 / 1000)


class TestComputeRetryBackoff:
    def test_first_retry_uses_min_backoff_bounds(self) -> None:
        low, high = _jitter_bounds(settings.WORKER_MIN_BACKOFF_MILLISECONDS, 0)
        for _ in range(50):
            assert low <= compute_retry_backoff("dummy", 1) <= high

    def test_backoff_grows_with_receive_count(self) -> None:
        low, high = _jitter_bounds(settings.WORKER_MIN_BACKOFF_MILLISECONDS, 2)
        for _ in range(50):
            assert low <= compute_retry_backoff("dummy", 3) <= high

    def test_caps_at_sqs_visibility_limit(self) -> None:
        for _ in range(50):
            assert (
                compute_retry_backoff("dummy", 40)
                == _sqs.MAX_VISIBILITY_TIMEOUT_SECONDS
            )

    def test_honors_min_backoff_setting(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_MIN_BACKOFF_MILLISECONDS", 10_000)
        low, high = _jitter_bounds(10_000, 0)
        for _ in range(50):
            assert low <= compute_retry_backoff("dummy", 1) <= high


class TestSetMessageVisibility:
    def test_changes_visibility_for_queue(self, mocker: MockerFixture) -> None:
        client = mocker.MagicMock()
        client.get_queue_url.return_value = {"QueueUrl": "https://sqs/queue"}
        mocker.patch.object(_sqs, "get_consumer_sqs_client", return_value=client)
        _sqs._queue_url_cache.clear()

        _sqs.set_message_visibility(
            "arn:aws:sqs:us-east-2:123456789012:polar-sandbox-tasks-dummy",
            "receipt-handle",
            42,
        )

        client.get_queue_url.assert_called_once_with(
            QueueName="polar-sandbox-tasks-dummy"
        )
        client.change_message_visibility.assert_called_once_with(
            QueueUrl="https://sqs/queue",
            ReceiptHandle="receipt-handle",
            VisibilityTimeout=42,
        )
