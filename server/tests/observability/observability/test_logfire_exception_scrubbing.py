import logfire
from logfire.testing import TestExporter
from opentelemetry.sdk.trace import Event, ReadableSpan
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import Status, StatusCode

from polar.logfire import _ExceptionMessageSpanProcessor, _scrub_recorded_exception

_LEAKED = (
    "DETAIL: Key (lower(email::text))=(person@example.com) already exists.\n"
    "[SQL: INSERT INTO users (email) VALUES ($1)]\n"
    "[parameters: (False, 'person@example.com')]\n"
    "(Background on this error at: https://sqlalche.me/e/20/gkpj)"
)


def test_span_processor_redacts_status_and_exception_event() -> None:
    span = ReadableSpan(
        name="INSERT users",
        status=Status(StatusCode.ERROR, _LEAKED),
        events=[
            Event(
                "exception",
                {
                    "exception.type": "sqlalchemy.exc.IntegrityError",
                    "exception.message": _LEAKED,
                    "exception.stacktrace": f"Traceback:\nIntegrityError: {_LEAKED}",
                },
            )
        ],
    )

    _ExceptionMessageSpanProcessor().on_end(span)

    assert span.status.description is not None
    assert "person@example.com" not in span.status.description
    assert "[parameters: [Redacted]]" in span.status.description
    assert "INSERT INTO users" in span.status.description
    assert "https://sqlalche.me/e/20/gkpj" in span.status.description
    event = span.events[0]
    assert event.attributes is not None
    assert "person@example.com" not in str(event.attributes["exception.message"])
    assert "person@example.com" not in str(event.attributes["exception.stacktrace"])
    assert event.attributes["exception.type"] == "sqlalchemy.exc.IntegrityError"


def test_recorded_exception_message_is_redacted_before_export() -> None:
    exporter = TestExporter()
    logfire.configure(
        send_to_logfire=False,
        console=False,
        advanced=logfire.AdvancedOptions(exception_callback=_scrub_recorded_exception),
        additional_span_processors=[
            _ExceptionMessageSpanProcessor(),
            SimpleSpanProcessor(exporter),
        ],
    )

    try:
        with logfire.span("signup"):
            raise RuntimeError(_LEAKED)
    except RuntimeError:
        pass

    exported = "\n".join(span.to_json() for span in exporter.exported_spans)
    assert "person@example.com" not in exported
    assert "[parameters: [Redacted]]" in exported
