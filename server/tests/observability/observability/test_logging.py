import logging
from collections.abc import Iterator
from functools import partial
from io import StringIO
from typing import Any

import logfire
import pytest
import structlog
from logfire.integrations.structlog import LogfireProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pytest_mock import MockerFixture

from polar.logging import Development, Logger, Production
from polar.observability.pii import REDACTED

type LoggingPipeline = tuple[
    Logger, logging.Logger, StringIO, InMemorySpanExporter | None
]


@pytest.fixture(
    params=[(Development, False), (Production, False), (Production, True)],
    ids=["console", "json", "json-with-logfire"],
)
def logging_pipeline(
    request: pytest.FixtureRequest,
    mocker: MockerFixture,
    configured_logfire: tuple[logfire.Logfire, InMemorySpanExporter],
) -> Iterator[LoggingPipeline]:
    configuration, forward_to_logfire = request.param
    instance, exporter = configured_logfire
    mocker.patch(
        "polar.logging.LogfireProcessor",
        partial(LogfireProcessor, logfire_instance=instance),
    )
    dict_config = mocker.patch("polar.logging.logging.config.dictConfig")
    configuration.configure_stdlib(logfire=forward_to_logfire)
    formatter_config: dict[str, Any] = dict_config.call_args.args[0]["formatters"][
        "polar"
    ]
    formatter_type = formatter_config.pop("()")
    stream = StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(formatter_type(**formatter_config))
    stdlib_logger = logging.getLogger("pii-test")
    mocker.patch.object(stdlib_logger, "handlers", [handler])
    mocker.patch.object(stdlib_logger, "level", logging.DEBUG)
    mocker.patch.object(stdlib_logger, "disabled", False)
    mocker.patch.object(stdlib_logger, "propagate", False)
    logger = structlog.wrap_logger(
        stdlib_logger,
        processors=configuration.get_processors(logfire=forward_to_logfire),
        wrapper_class=structlog.stdlib.BoundLogger,
    )
    yield logger, stdlib_logger, stream, exporter if forward_to_logfire else None
    handler.close()


class TestLoggingOutput:
    def test_structlog_and_stdlib_redaction(
        self, logging_pipeline: LoggingPipeline
    ) -> None:
        logger, stdlib_logger, stream, exporter = logging_pipeline
        fields = {
            "customer_email": "alice@example.com",
            "customer_name": "PII_CANARY_PERSON",
            "correlation_id": "validation-123",
        }
        logger.error("structured contact %s", fields["customer_email"], **fields)
        stdlib_logger.error("stdlib contact %s", fields["customer_email"], extra=fields)

        output = stream.getvalue()
        assert "structured contact" in output
        assert "stdlib contact" in output
        assert "validation-123" in output
        assert REDACTED in output
        assert fields["customer_email"] not in output
        assert fields["customer_name"] not in output
        if exporter is not None:
            spans = exporter.get_finished_spans()
            assert len(spans) == 2
            for span in spans:
                serialized = span.to_json()
                assert "validation-123" in serialized
                assert REDACTED in serialized
                assert fields["customer_email"] not in serialized
                assert fields["customer_name"] not in serialized

    def test_exception_redaction(self, logging_pipeline: LoggingPipeline) -> None:
        logger, stdlib_logger, stream, exporter = logging_pipeline
        email = "alice@example.com"
        secret = "sk_live_abc123"
        try:
            raise ValueError(f"failed for {email} using {secret}")
        except ValueError:
            logger.exception("structured failure")
            stdlib_logger.exception("stdlib failure")

        output = stream.getvalue()
        assert "structured failure" in output
        assert "stdlib failure" in output
        assert "Traceback" in output
        assert "ValueError" in output
        assert REDACTED in output
        assert email not in output
        assert secret not in output
        if exporter is not None:
            spans = exporter.get_finished_spans()
            assert len(spans) == 2
            for span in spans:
                serialized = span.to_json()
                assert any(event.name == "exception" for event in span.events)
                assert "ValueError" in serialized
                assert REDACTED in serialized
                assert email not in serialized
                assert secret not in serialized
