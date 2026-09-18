from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import re2
from stdnum import iban, luhn

REDACTED = "[Redacted]"

SENSITIVE_KEYS = frozenset(
    {
        "http.url",
        "url",
        "email",
        "customer_email",
        "user_email",
        "owner_email",
        "billing_email",
        "name",
        "full_name",
        "first_name",
        "last_name",
        "billing_name",
        "customer_name",
        "username",
        "account_username",
        "phone",
        "phone_number",
        "address",
        "billing_address",
        "shipping_address",
        "line1",
        "line2",
        "postal_code",
        "zip",
        "ip",
        "ip_address",
        "client_ip",
        "ssn",
        "social_security",
        "tax_id",
        "date_of_birth",
        "dob",
        "card_number",
        "pan",
        "cvv",
        "cvc",
        "iban",
        "account_number",
        "routing_number",
        "fingerprint",
        "processor_id",
        "password",
        "passwd",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "api_key",
        "authorization",
        "cookie",
        "session",
        "jwt",
        "credential",
        "private_key",
    }
)

SAFE_KEYS = frozenset(
    {
        "subject",
        "thread_stacks",
        "event_loop_stack",
        "asyncio_tasks",
        "subject_id",
        "customer_id",
        "organization_id",
        "order_id",
        "user_id",
        "correlation_id",
        "event",
        "logger",
        "logger_name",
        "level",
        "timestamp",
        "service_name",
    }
)

_EMAIL_RE = re2.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
)
_PAN_RE = re2.compile(
    r"(?P<uuid>\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\b)"
    r"|(?:\d[ \-]?){13,19}"
)
_IBAN_RE = re2.compile(r"(?i)\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b")
_JWT_RE = re2.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
# RE2's \s is ASCII-only; preserve Unicode whitespace handling for bearer tokens.
_WHITESPACE_CLASS = r"\s\p{Z}\x{0085}\x{001c}-\x{001f}"
_BEARER_RE = re2.compile(rf"[Bb]earer[{_WHITESPACE_CLASS}]+[^{_WHITESPACE_CLASS}]+")
_STRIPE_SECRET_RE = re2.compile(
    r"(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+"
)


def scrub_event(event: Mapping[str, Any]) -> dict[str, Any]:
    return {key: scrub_value(value, key=key) for key, value in event.items()}


def scrub_value(value: Any, *, key: str | None = None) -> Any:
    if key is not None and _is_safe_key(key):
        return _walk(value)
    if key is not None and _is_sensitive_key(key):
        return REDACTED
    return _walk(value)


def _is_safe_key(key: str) -> bool:
    return not SAFE_KEYS.isdisjoint(_key_forms(key))


def _is_sensitive_key(key: str) -> bool:
    return not SENSITIVE_KEYS.isdisjoint(_key_forms(key))


def _key_forms(key: str) -> frozenset[str]:
    dotted = key.lower().replace("-", "_")
    return frozenset({dotted, dotted.replace(".", "_"), dotted.rsplit(".", 1)[-1]})


def _walk(value: Any) -> Any:
    if isinstance(value, str):
        return _scrub_string(value)
    if isinstance(value, Mapping):
        return {key: scrub_value(item, key=key) for key, item in value.items()}
    if isinstance(value, list):
        return [scrub_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(scrub_value(item) for item in value)
    return value


def _replace_iban(match: Any) -> str:
    value = match.group(0)
    return REDACTED if iban.is_valid(value) else value


def _replace_pan(match: Any) -> str:
    if match.group("uuid") is not None:
        return match.group(0)
    digits = match.group(0).replace(" ", "").replace("-", "")
    if 13 <= len(digits) <= 19 and luhn.is_valid(digits):
        return REDACTED
    return match.group(0)


def _scrub_string(value: str) -> str:
    # RE2 requires a plain str, not a str-based Enum.
    value = _EMAIL_RE.sub(REDACTED, str.__str__(value))
    value = _JWT_RE.sub(REDACTED, value)
    value = _BEARER_RE.sub(REDACTED, value)
    value = _STRIPE_SECRET_RE.sub(REDACTED, value)
    value = _IBAN_RE.sub(_replace_iban, value)
    value = _PAN_RE.sub(_replace_pan, value)
    return value


# Logfire includes matched text in its default replacement and metadata.
# Only field names belong here; value redaction runs before its scrubber.
LOGFIRE_EXTRA_PATTERNS: tuple[str, ...] = tuple(
    rf"(?:^|[.]){re2.escape(key)}$" for key in sorted(SENSITIVE_KEYS)
)


__all__ = [
    "LOGFIRE_EXTRA_PATTERNS",
    "REDACTED",
    "SAFE_KEYS",
    "SENSITIVE_KEYS",
    "scrub_event",
    "scrub_value",
]
