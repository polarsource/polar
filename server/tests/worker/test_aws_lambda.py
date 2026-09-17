import importlib
import sys
import time
from collections.abc import Iterator
from types import ModuleType

import pytest
import structlog
from dramatiq.errors import Retry
from logfire.integrations.structlog import LogfireProcessor
from logfire.testing import CaptureLogfire
from pytest_mock import MockerFixture

from polar.config import settings
from polar.worker._sqs import build_envelope


@pytest.fixture
def aws_lambda(mocker: MockerFixture) -> Iterator[ModuleType]:
    mocker.patch("polar.sentry.configure_sentry")
    mocker.patch("polar.logfire.configure_logfire")
    mocker.patch("polar.logging.configure")
    mocker.patch("polar.worker._runner.bootstrap")
    mocker.patch("polar.worker._sqs.get_consumer_sqs_client")
    mocker.patch("polar.worker._sqs.get_consumer_scheduler_client")
    mocker.patch("asyncio.set_event_loop")
    module = importlib.import_module("polar.worker.aws_lambda")
    mocker.patch.object(
        module,
        "log",
        structlog.wrap_logger(
            structlog.ReturnLogger(),
            processors=[LogfireProcessor()],
            wrapper_class=structlog.stdlib.BoundLogger,
        ),
    )
    yield module
    module._loop.close()
    sys.modules.pop(module.__name__, None)


class TestHandler:
    @pytest.mark.parametrize(
        "exception", [ValueError("boom"), Retry(delay=1000)], ids=["failure", "retry"]
    )
    def test_failure_logs_share_task_trace(
        self,
        exception: Exception,
        aws_lambda: ModuleType,
        capfire: CaptureLogfire,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": mocker.AsyncMock(side_effect=exception)},
        )
        mocker.patch.object(aws_lambda, "send_delayed_message")
        context = mocker.Mock()
        context.get_remaining_time_in_millis.return_value = 30000
        event = {
            "Records": [
                {
                    "messageId": "message-1",
                    "body": build_envelope("dummy", (), {}, "source-1"),
                    "eventSourceARN": "arn:aws:sqs:us-east-1:123456789012:test",
                }
            ]
        }

        assert aws_lambda.handler(event, context) == {"batchItemFailures": []}
        spans = capfire.exporter.exported_spans
        (task_span,) = [
            span
            for span in spans
            if span.name == "TASK {actor}"
            and span.attributes is not None
            and span.attributes.get("logfire.span_type") == "span"
        ]
        assert task_span.context is not None
        log_names = {"polar.worker.sqs_retry_reenqueued"}
        if not isinstance(exception, Retry):
            log_names.add("polar.worker.sqs_task_failed")
        logs = [span for span in spans if span.name in log_names]
        assert {span.name for span in logs} == log_names
        for span in logs:
            assert span.parent is not None
            assert span.context is not None
            assert span.context.trace_id == task_span.context.trace_id

    def test_ignored_actor_debounce_log_is_suppressed(
        self,
        aws_lambda: ModuleType,
        capfire: CaptureLogfire,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": mocker.AsyncMock()},
        )
        mocker.patch.object(settings, "LOGFIRE_IGNORED_ACTORS", {"dummy"})
        mocker.patch("polar.worker._debounce.log", aws_lambda.log)
        redis = mocker.Mock()
        redis.hgetall = mocker.AsyncMock(
            return_value={
                "executed": "0",
                "message_id": "other",
                "enqueue_timestamp": str(int(time.time())),
            }
        )
        mocker.patch("polar.worker._runner.RedisMiddleware.get", return_value=redis)
        context = mocker.Mock()
        context.get_remaining_time_in_millis.return_value = 30000
        event = {
            "Records": [
                {
                    "messageId": "message-1",
                    "body": build_envelope(
                        "dummy",
                        (),
                        {},
                        "source-1",
                        message_id="message-1",
                        debounce_key="debounce:dummy",
                    ),
                    "eventSourceARN": "arn:aws:sqs:us-east-1:123456789012:test",
                }
            ]
        }

        assert aws_lambda.handler(event, context) == {"batchItemFailures": []}
        assert capfire.exporter.exported_spans == []
