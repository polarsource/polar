import re
from enum import StrEnum

import pytest

from polar.observability.pii import (
    LOGFIRE_EXTRA_PATTERNS,
    REDACTED,
    scrub_event,
    scrub_value,
)

VISA_TEST_PAN = "4111111111111111"
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"


class TestScrubEvent:
    def test_redacts_sensitive_keys(self) -> None:
        result = scrub_event(
            {
                "email": "alice@example.com",
                "Email": "bob@example.com",
                "customer_email": "carol@example.com",
                "user.email": "dave@example.com",
                "username": "alice",
                "processor_id": "pm_123",
                "url": "https://example.invalid/verify?token=opaqueCredential",
                "last4": "4242",
                "customer_id": "cus-uuid",
            }
        )
        assert result["email"] == REDACTED
        assert result["Email"] == REDACTED
        assert result["customer_email"] == REDACTED
        assert result["user.email"] == REDACTED
        assert result["username"] == REDACTED
        assert result["processor_id"] == REDACTED
        assert result["url"] == REDACTED
        assert result["last4"] == "4242"
        assert result["customer_id"] == "cus-uuid"

    def test_redacts_nested_and_lists(self) -> None:
        result = scrub_event(
            {
                "customer": {"email": "nested@example.com", "id": "abc"},
                "recipients": ["a@example.com", "ok"],
            }
        )
        assert result["customer"]["email"] == REDACTED
        assert result["customer"]["id"] == "abc"
        assert result["recipients"] == [REDACTED, "ok"]

    def test_safe_parent_does_not_exempt_nested_keys(self) -> None:
        result = scrub_event(
            {
                "subject": {
                    "name": "Alice",
                    "items": [{"password": "opaqueCredential"}],
                    "details": ({"token": "opaqueToken"},),
                    "customer_id": "customer-123",
                }
            }
        )
        assert result == {
            "subject": {
                "name": REDACTED,
                "items": [{"password": REDACTED}],
                "details": ({"token": REDACTED},),
                "customer_id": "customer-123",
            }
        }

    def test_does_not_mutate_input(self) -> None:
        customer = {"name": "Alice"}
        event = {"email": "alice@example.com", "customer": customer}
        scrub_event(event)
        assert event["email"] == "alice@example.com"
        assert customer["name"] == "Alice"

    def test_preserves_logger_name(self) -> None:
        result = scrub_event(
            {
                "event": "user.created",
                "logger_name": "polar.user.service",
                "service_name": "api",
            }
        )
        assert result["event"] == "user.created"
        assert result["logger_name"] == "polar.user.service"
        assert result["service_name"] == "api"

    def test_redacts_email_in_event_message(self) -> None:
        result = scrub_event({"event": "threads for alice@example.com"})
        assert result["event"] == f"threads for {REDACTED}"


class TestScrubValue:
    def test_string_enums(self) -> None:
        class Value(StrEnum):
            EMAIL = "alice@example.com"
            SAFE = "ok"

        assert scrub_value(Value.EMAIL) == REDACTED
        assert scrub_value(Value.SAFE) == "ok"

    def test_sensitive_key_redacts_wholesale(self) -> None:
        assert scrub_value({"line1": "1 Main St"}, key="billing_address") == REDACTED

    def test_safe_key_keeps_stack_but_redacts_email(self) -> None:
        stack = (
            "File sqlalchemy/orm/session.py, line 1\n"
            "customer_email = 'alice@example.com'\n"
        )
        result = scrub_value(stack, key="thread_stacks")
        assert "sqlalchemy/orm/session.py" in result
        assert "alice@example.com" not in result
        assert REDACTED in result

    @pytest.mark.parametrize(
        "raw",
        [
            "alice@example.com",
            VISA_TEST_PAN,
            "DE89370400440532013000",
            "gb82west12345698765432",
            "Gb82West12345698765432",
            JWT,
            "Bearer abc.def",
            "sk_live_abc123",
        ],
    )
    @pytest.mark.parametrize("template", ["{}", "pre {} post"])
    def test_value_patterns(self, raw: str, template: str) -> None:
        result = scrub_value(template.format(raw))
        assert raw not in result
        assert REDACTED in result

    @pytest.mark.parametrize("space", ["\u00a0", "\u202f", "\u0085", "\u001c"])
    def test_bearer_unicode_whitespace(self, space: str) -> None:
        assert (
            scrub_value(f"Bearer{space}abc.def{space}suffix")
            == f"{REDACTED}{space}suffix"
        )

    @pytest.mark.parametrize("key", [None, "correlation_id", "customer_id"])
    def test_preserves_numeric_uuid(self, key: str | None) -> None:
        identifier = "12345678-1234-4123-8123-123456789012"
        assert scrub_value(identifier, key=key) == identifier
        assert scrub_value(f"id={identifier}; card={VISA_TEST_PAN}", key=key) == (
            f"id={identifier}; card={REDACTED}"
        )

    @pytest.mark.parametrize(
        "pan", [VISA_TEST_PAN, "4111-1111-1111-1111", "4111 1111 1111 1111"]
    )
    def test_redacts_card_under_safe_identifier_key(self, pan: str) -> None:
        assert scrub_value(pan, key="correlation_id") == REDACTED

    def test_preserves_hex_identifier(self) -> None:
        identifier = "de12ab34cd56ef78ab90cd12ef34ab56"
        assert scrub_value(identifier) == identifier

    def test_non_luhn_digits_kept(self) -> None:
        number = "123456789012345"
        assert scrub_value(number) == number


class TestLoggingIntegration:
    def test_logfire_patterns_skip_logger_name(self) -> None:
        pattern = re.compile("|".join(LOGFIRE_EXTRA_PATTERNS), re.IGNORECASE)
        assert pattern.search("email")
        assert pattern.search("user.email")
        assert pattern.search("logger_name") is None
