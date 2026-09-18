from polar.observability.pii import REDACTED

from .conftest import LoggingPipeline


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
