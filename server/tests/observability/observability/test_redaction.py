from opentelemetry.sdk.trace import Event, ReadableSpan
from opentelemetry.trace import Status, StatusCode

from polar.observability.redaction import ExceptionRedactionSpanProcessor, redact_text

_LEAKED = (
    'duplicate key value violates unique constraint "ix_users_email_case_insensitive"\n'
    "DETAIL:  Key (lower(email::text))=(ada.lovelace+test@mail.example.co.uk) already exists."
)


def test_redact_text() -> None:
    assert redact_text(_LEAKED) == (
        'duplicate key value violates unique constraint "ix_users_email_case_insensitive"\n'
        "DETAIL:  Key (lower(email::text))=([redacted]) already exists."
    )
    assert redact_text("secret polar_oat_abcDEF123xyzBeLi0123456789") == (
        "secret [redacted]"
    )
    assert redact_text("polar_self.create_customer") == "polar_self.create_customer"


def test_span_processor_redacts_status_and_exception_events() -> None:
    span = ReadableSpan(
        name="POST /v1/auth/email-otp/verify",
        status=Status(StatusCode.ERROR, _LEAKED),
        events=[
            Event(
                "exception",
                {
                    "exception.type": "sqlalchemy.exc.IntegrityError",
                    "exception.message": _LEAKED,
                    "exception.stacktrace": f"Traceback:\n{_LEAKED}",
                },
            ),
            Event("log"),
        ],
    )

    ExceptionRedactionSpanProcessor().on_end(span)

    assert "ada.lovelace" not in span.to_json()
    assert span.status.status_code == StatusCode.ERROR
    assert span.status.description == redact_text(_LEAKED)
    attributes = span.events[0].attributes
    assert attributes is not None
    assert attributes["exception.type"] == "sqlalchemy.exc.IntegrityError"
    assert span.events[1].name == "log"
