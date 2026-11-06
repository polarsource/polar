import re
from typing import Any

from opentelemetry.attributes import BoundedAttributes
from opentelemetry.sdk.trace import Event, ReadableSpan, Span, SpanProcessor
from opentelemetry.trace import Status
from opentelemetry.util import types as otel_types

# Logfire does not scrub exception.message, exception.stacktrace, or span
# status descriptions. SQLAlchemy IntegrityError text and PostgreSQL DETAIL
# lines put bound values such as email addresses in those fields.
_EMAIL_ADDRESS = re.compile(r"(?i)\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b")
_EXCEPTION_TEXT_KEYS = ("exception.message", "exception.stacktrace")
REDACTED_EMAIL = "[redacted]"


def redact_email_addresses(value: str) -> str:
    return _EMAIL_ADDRESS.sub(REDACTED_EMAIL, value)


def _redact_attributes(
    attributes: otel_types.Attributes,
) -> BoundedAttributes | None:
    if not attributes:
        return None

    redacted: dict[str, Any] | None = None
    for key in _EXCEPTION_TEXT_KEYS:
        value = attributes.get(key)
        if not isinstance(value, str):
            continue
        cleaned = redact_email_addresses(value)
        if cleaned == value:
            continue
        if redacted is None:
            redacted = dict(attributes)
        redacted[key] = cleaned
    if redacted is None:
        return None
    return BoundedAttributes(attributes=redacted, immutable=True)


def _redact_event(event: Event) -> None:
    redacted = _redact_attributes(event.attributes)
    if redacted is None:
        return
    # Event attributes are immutable, and the span stores events in an
    # append-only sequence, so replace the mapping on the existing event.
    event._attributes = redacted


def _redact_span(span: ReadableSpan) -> None:
    # set_status refuses to replace an error description that is already set,
    # and Logfire forwards a ReadableSpan that has no set_status.
    description = span.status.description
    if description:
        cleaned = redact_email_addresses(description)
        if cleaned != description:
            span._status = Status(span.status.status_code, cleaned)

    attributes = _redact_attributes(span.attributes)
    if attributes is not None:
        span._attributes = attributes

    for event in span._events:
        _redact_event(event)


class ExceptionMessageSpanProcessor(SpanProcessor):
    def _on_ending(self, span: Span) -> None:
        _redact_span(span)

    def on_end(self, span: ReadableSpan) -> None:
        # Logfire's processor wrappers do not forward _on_ending. They rebuild
        # a ReadableSpan and call on_end before the exporter reads it.
        _redact_span(span)
