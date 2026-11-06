import re

from opentelemetry.sdk.trace import Event, ReadableSpan, SpanProcessor
from opentelemetry.trace import Status

_EMAIL = r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"
_POLAR_TOKEN = r"polar_[a-z]+_[A-Za-z0-9]{16,}"
_SENSITIVE_TEXT = re.compile(f"{_EMAIL}|{_POLAR_TOKEN}")
_EXCEPTION_TEXT_KEYS = ("exception.message", "exception.stacktrace")
_REDACTED = "[redacted]"


def redact_text(text: str) -> str:
    return _SENSITIVE_TEXT.sub(_REDACTED, text)


class ExceptionRedactionSpanProcessor(SpanProcessor):
    """Logfire treats exception text and span status as safe and never scrubs them."""

    def on_end(self, span: ReadableSpan) -> None:
        if span.status.description:
            span._status = Status(
                span.status.status_code, redact_text(span.status.description)
            )
        span._events = [
            Event(
                event.name,
                {
                    key: redact_text(value)
                    if key in _EXCEPTION_TEXT_KEYS and isinstance(value, str)
                    else value
                    for key, value in event.attributes.items()
                },
                event.timestamp,
            )
            if event.attributes
            else event
            for event in span.events
        ]
