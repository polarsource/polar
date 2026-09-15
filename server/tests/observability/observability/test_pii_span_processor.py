import json

import logfire
import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Link, SpanContext, Status, StatusCode

from polar.observability.pii import REDACTED
from polar.observability.pii_span_processor import PiiSpanProcessor


class TestPiiSpanProcessor:
    @pytest.mark.parametrize(
        "secret",
        ["alice@example.com", "sk_live_abc123", "rk_test_abc123", "whsec_abc123"],
    )
    @pytest.mark.parametrize("template", ["{}", "contact {} now"])
    def test_redacts_values_before_logfire(
        self,
        configured_logfire: tuple[logfire.Logfire, InMemorySpanExporter],
        secret: str,
        template: str,
    ) -> None:
        instance, exporter = configured_logfire
        provider = instance.config.get_tracer_provider().provider
        assert isinstance(provider, TracerProvider)
        assert isinstance(
            provider._active_span_processor._span_processors[0], PiiSpanProcessor
        )
        value = template.format(secret)
        tracer = provider.get_tracer("test")
        with tracer.start_as_current_span(
            value,
            attributes={"detail": value, "logfire.msg": value},
            links=[Link(SpanContext(1, 1, False), {"detail": value})],
        ) as span:
            span.set_attribute("late_detail", value)
            span.add_event(value, {"exception.message": value, "detail": value})
            span.set_status(Status(StatusCode.ERROR, value))

        (exported,) = exporter.get_finished_spans()
        assert secret not in exported.to_json()
        assert exported.attributes is not None
        assert exported.attributes["detail"] == template.format(REDACTED)
        assert exported.attributes["late_detail"] == template.format(REDACTED)
        assert exported.attributes["logfire.msg"] == template.format(REDACTED)
        assert "logfire.scrubbed" not in exported.attributes

    def test_direct_logfire_messages_and_metadata(
        self, configured_logfire: tuple[logfire.Logfire, InMemorySpanExporter]
    ) -> None:
        instance, exporter = configured_logfire
        instance.error(
            "contact {detail} now",
            detail="alice@example.com sk_live_abc123",
            password="opaqueCredential",
            payload={"detail": "alice@example.com", "secret": "opaqueCredential"},
        )
        (exported,) = exporter.get_finished_spans()
        serialized = exported.to_json()
        assert "alice@example.com" not in serialized
        assert "sk_live_abc123" not in serialized
        assert "opaqueCredential" not in serialized
        assert exported.attributes is not None
        message = exported.attributes["logfire.msg"]
        assert isinstance(message, str)
        assert REDACTED in message
        assert "logfire.scrubbed" not in json.loads(serialized)["attributes"]
