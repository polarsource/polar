import pytest
from opentelemetry.sdk.trace import Event, ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Status, StatusCode

from polar.observability.exception_telemetry import (
    REDACTED_EMAIL,
    ExceptionMessageSpanProcessor,
    redact_email_addresses,
)

_EMAIL = "ada@example.com"
_INTEGRITY_MESSAGE = (
    'duplicate key value violates unique constraint "ix_users_email_case_insensitive"\n'
    f"DETAIL:  Key (lower(email))=({_EMAIL}) already exists.\n"
    f"[parameters: {{'email': '{_EMAIL}'}}]"
)


def test_redact_email_addresses_keeps_constraint_name() -> None:
    redacted = redact_email_addresses(_INTEGRITY_MESSAGE)

    assert _EMAIL not in redacted
    assert redacted.count(REDACTED_EMAIL) == 2
    assert "ix_users_email_case_insensitive" in redacted


def test_span_exception_text_drops_email() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(ExceptionMessageSpanProcessor())
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("test")

    with pytest.raises(RuntimeError):
        with tracer.start_as_current_span("email otp verify"):
            raise RuntimeError(_INTEGRITY_MESSAGE)

    provider.force_flush()
    spans = exporter.get_finished_spans()
    assert len(spans) == 1
    span = spans[0]
    assert _EMAIL not in span.to_json()
    assert span.status.description is not None
    assert "ix_users_email_case_insensitive" in span.status.description

    messages = [
        event.attributes.get("exception.message")
        for event in span.events
        if event.attributes is not None
    ]
    assert messages
    assert all(
        isinstance(message, str) and _EMAIL not in message for message in messages
    )
    assert any(
        isinstance(message, str) and "ix_users_email_case_insensitive" in message
        for message in messages
    )


def test_on_end_redacts_readable_span_logfire_forwards() -> None:
    span = ReadableSpan(
        name="INSERT users",
        attributes={
            "exception.message": _INTEGRITY_MESSAGE,
            "db.system": "postgresql",
        },
        events=[
            Event(
                "exception",
                {
                    "exception.message": _INTEGRITY_MESSAGE,
                    "exception.stacktrace": _INTEGRITY_MESSAGE,
                    "exception.type": "IntegrityError",
                },
            )
        ],
        status=Status(StatusCode.ERROR, _INTEGRITY_MESSAGE),
    )

    ExceptionMessageSpanProcessor().on_end(span)

    assert _EMAIL not in span.to_json()
    assert span.status.description is not None
    assert "ix_users_email_case_insensitive" in span.status.description
    assert span.attributes is not None
    assert span.attributes["db.system"] == "postgresql"
    assert span.attributes["exception.message"] == redact_email_addresses(
        _INTEGRITY_MESSAGE
    )
