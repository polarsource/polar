import json
import math

import pytest
from botocore.exceptions import ClientError
from dramatiq.errors import Retry
from dramatiq.middleware.retries import DEFAULT_MAX_BACKOFF
from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.config import settings
from polar.worker import _sqs
from polar.worker._runner import (
    RetryAction,
    compute_retry_backoff,
    get_actor_max_retries,
    plan_retry,
)

MAX_BACKOFF_SECONDS = math.ceil(DEFAULT_MAX_BACKOFF / 1000)


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

    def test_caps_at_dramatiq_max_backoff(self) -> None:
        for _ in range(50):
            backoff = compute_retry_backoff("dummy", 40)
            assert _sqs.MAX_VISIBILITY_TIMEOUT_SECONDS < backoff <= MAX_BACKOFF_SECONDS

    def test_honors_min_backoff_setting(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_MIN_BACKOFF_MILLISECONDS", 10_000)
        low, high = _jitter_bounds(10_000, 0)
        for _ in range(50):
            assert low <= compute_retry_backoff("dummy", 1) <= high

    def test_explicit_retry_delay_overrides_backoff(self) -> None:
        assert compute_retry_backoff("dummy", 5, Retry(delay=30_000)) == 30

    def test_explicit_retry_delay_above_visibility_not_clamped(self) -> None:
        delay_ms = 13 * 3600 * 1000
        assert compute_retry_backoff("dummy", 1, Retry(delay=delay_ms)) == 13 * 3600

    def test_explicit_retry_delay_capped_at_max_backoff(self) -> None:
        assert (
            compute_retry_backoff("dummy", 1, Retry(delay=DEFAULT_MAX_BACKOFF * 2))
            == MAX_BACKOFF_SECONDS
        )

    def test_retry_without_delay_uses_exponential_backoff(self) -> None:
        low, high = _jitter_bounds(settings.WORKER_MIN_BACKOFF_MILLISECONDS, 0)
        for _ in range(50):
            assert low <= compute_retry_backoff("dummy", 1, Retry()) <= high


class TestSetMessageVisibility:
    def test_changes_visibility_for_queue(self, mocker: MockerFixture) -> None:
        client = mocker.MagicMock()
        client.get_queue_url.return_value = {"QueueUrl": "https://sqs/queue"}
        _sqs._queue_url_cache.clear()

        _sqs.set_message_visibility(
            client,
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


class TestEnvelopeAttempt:
    def test_round_trips(self) -> None:
        body = _sqs.build_envelope("dummy", (1, "x"), {"k": 2}, "corr", 7)
        actor, args, kwargs, correlation_id, attempt = _sqs.parse_envelope(body)
        assert actor == "dummy"
        assert args == [1, "x"]
        assert kwargs == {"k": 2}
        assert correlation_id == "corr"
        assert attempt == 7

    def test_defaults_to_one(self) -> None:
        body = _sqs.build_envelope("dummy", (), {}, None)
        *_, attempt = _sqs.parse_envelope(body)
        assert attempt == 1

    def test_legacy_body_without_attempt(self) -> None:
        body = json.dumps(
            {"actor": "dummy", "args": [], "kwargs": {}, "correlation_id": None}
        )
        *_, attempt = _sqs.parse_envelope(body)
        assert attempt == 1


class TestPlanRetry:
    def test_dead_letters_when_exhausted(self) -> None:
        max_retries = get_actor_max_retries("dummy")
        action, _ = plan_retry("dummy", max_retries + 1, None, scheduler_available=True)
        assert action is RetryAction.DEAD_LETTER

    def test_retries_one_below_the_limit(self) -> None:
        max_retries = get_actor_max_retries("dummy")
        action, _ = plan_retry("dummy", max_retries, None, scheduler_available=True)
        assert action is not RetryAction.DEAD_LETTER

    def test_sets_visibility_for_short_backoff(self) -> None:
        action, delay = plan_retry("dummy", 1, None, scheduler_available=True)
        assert action is RetryAction.SET_VISIBILITY
        assert delay <= _sqs.MAX_VISIBILITY_TIMEOUT_SECONDS

    def test_schedules_when_backoff_exceeds_visibility(self) -> None:
        long_delay = Retry(delay=2 * _sqs.MAX_VISIBILITY_TIMEOUT_SECONDS * 1000)
        action, delay = plan_retry("dummy", 1, long_delay, scheduler_available=True)
        assert action is RetryAction.SCHEDULE
        assert delay > _sqs.MAX_VISIBILITY_TIMEOUT_SECONDS

    def test_clamps_to_visibility_when_scheduler_unavailable(self) -> None:
        long_delay = Retry(delay=2 * _sqs.MAX_VISIBILITY_TIMEOUT_SECONDS * 1000)
        action, delay = plan_retry("dummy", 1, long_delay, scheduler_available=False)
        assert action is RetryAction.SET_VISIBILITY
        assert delay == _sqs.MAX_VISIBILITY_TIMEOUT_SECONDS


class TestBuildRetryScheduleName:
    def test_is_deterministic(self) -> None:
        first = _sqs.build_retry_schedule_name("arn:q", "msg-1", 3)
        second = _sqs.build_retry_schedule_name("arn:q", "msg-1", 3)
        assert first == second
        assert first.startswith("polar-retry-")
        assert len(first) <= 64

    def test_varies_by_input(self) -> None:
        base = _sqs.build_retry_schedule_name("arn:q", "msg-1", 3)
        assert base != _sqs.build_retry_schedule_name("arn:q", "msg-2", 3)
        assert base != _sqs.build_retry_schedule_name("arn:q", "msg-1", 4)
        assert base != _sqs.build_retry_schedule_name("arn:q2", "msg-1", 3)


class TestScheduleDelayedMessage:
    def test_creates_one_time_schedule(self, mocker: MockerFixture) -> None:
        client = mocker.MagicMock()

        _sqs.schedule_delayed_message(
            client,
            "arn:aws:sqs:us-east-2:123456789012:polar-tasks-default",
            "arn:aws:iam::123456789012:role/scheduler",
            '{"actor":"dummy"}',
            48 * 3600,
            "polar-retry-abc123",
        )

        client.create_schedule.assert_called_once()
        kwargs = client.create_schedule.call_args.kwargs
        assert kwargs["Name"] == "polar-retry-abc123"
        assert kwargs["ScheduleExpression"].startswith("at(")
        assert kwargs["ActionAfterCompletion"] == "DELETE"
        assert kwargs["Target"] == {
            "Arn": "arn:aws:sqs:us-east-2:123456789012:polar-tasks-default",
            "RoleArn": "arn:aws:iam::123456789012:role/scheduler",
            "Input": '{"actor":"dummy"}',
        }

    def test_existing_schedule_is_idempotent(self, mocker: MockerFixture) -> None:
        client = mocker.MagicMock()
        client.create_schedule.side_effect = ClientError(
            {"Error": {"Code": "ConflictException", "Message": "exists"}},
            "CreateSchedule",
        )

        _sqs.schedule_delayed_message(
            client, "arn:q", "arn:role", "{}", 48 * 3600, "polar-retry-abc123"
        )

    def test_other_client_error_is_raised(self, mocker: MockerFixture) -> None:
        client = mocker.MagicMock()
        client.create_schedule.side_effect = ClientError(
            {"Error": {"Code": "ValidationException", "Message": "bad"}},
            "CreateSchedule",
        )

        with pytest.raises(ClientError):
            _sqs.schedule_delayed_message(
                client, "arn:q", "arn:role", "{}", 48 * 3600, "polar-retry-abc123"
            )


class TestSendToDlq:
    def test_sends_to_dlq_queue(self, mocker: MockerFixture) -> None:
        client = mocker.MagicMock()
        client.get_queue_url.return_value = {"QueueUrl": "https://sqs/queue-dlq"}
        _sqs._queue_url_cache.clear()

        _sqs.send_to_dlq(
            client,
            "arn:aws:sqs:us-east-2:123456789012:polar-tasks-default",
            '{"actor":"dummy"}',
        )

        client.get_queue_url.assert_called_once_with(
            QueueName="polar-tasks-default-dlq"
        )
        client.send_message.assert_called_once_with(
            QueueUrl="https://sqs/queue-dlq", MessageBody='{"actor":"dummy"}'
        )
