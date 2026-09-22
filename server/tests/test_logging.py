import json
import logging
from copy import deepcopy
from io import StringIO
from typing import Any

import pytest
import structlog
from pytest_mock import MockerFixture

from polar.logging import REDACTED, Production, _scrub_console_log, scrub_log_text


class TestScrubLogText:
    @pytest.mark.parametrize(
        ("message", "expected"),
        [
            ("Failed for alice@example.com", f"Failed for {REDACTED}"),
            (
                "Bearer abc123; Basic dXNlcjpwYXNz",
                f"{REDACTED}; {REDACTED}",
            ),
            (
                "Received eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
                f"Received {REDACTED}",
            ),
            (
                "Keys: sk_live_abc123, rk_test_def456, whsec_ghi789",
                f"Keys: {REDACTED}, {REDACTED}, {REDACTED}",
            ),
            ("Card: 4242 4242 4242 4242", f"Card: {REDACTED}"),
            ("IBAN: DE89370400440532013000", f"IBAN: {REDACTED}"),
            (
                "password='a secret'; api_key=abc123",
                f"{REDACTED}; {REDACTED}",
            ),
            (
                "Connecting to postgres://alice:secret@localhost/polar",
                f"Connecting to {REDACTED}localhost/polar",
            ),
        ],
        ids=["email", "auth", "jwt", "stripe", "card", "iban", "secrets", "url"],
    )
    def test_redacts_sensitive_text(self, message: str, expected: str) -> None:
        assert scrub_log_text(message) == expected

    def test_oversized_text_requires_explicit_preservation(self) -> None:
        message = "alice@example.com " + "x" * 32_768

        assert scrub_log_text(message) == REDACTED
        assert scrub_log_text(message, preserve_oversized=True) == message
        assert scrub_log_text("alice@example.com", preserve_oversized=True) == REDACTED


class TestScrubConsoleLog:
    def test_redacts_nested_fields_and_preserves_diagnostic_context(self) -> None:
        event: dict[str, Any] = {
            "event": "payment_failed",
            "customer": {
                "email": "alice@example.com",
                "billing-name": "Alice Smith",
                "address": {"line1": "123 Main Street", "city": "London"},
            },
            "attempts": [{"Authorization": "Bearer secret", "status": 403}],
            "http.url": "https://example.com/reset?token=secret",
            "service.name": "worker",
            "logger_name": "polar.payment",
            "order_id": "06b3ce47-3235-48f3-a197-4046076ca96e",
            "charge_id": "ch_3UEikKDG1jUQrXwC1",
            "retryable": True,
            "duration": 0.25,
            "result": None,
        }
        original = deepcopy(event)

        result = _scrub_console_log(logging.getLogger(__name__), "error", event)

        assert result == {
            **original,
            "customer": {
                "email": REDACTED,
                "billing-name": REDACTED,
                "address": REDACTED,
            },
            "attempts": [{"Authorization": REDACTED, "status": 403}],
            "http.url": REDACTED,
        }
        assert event == original

    def test_text_budget_is_shared_across_fields_and_resets_per_event(self) -> None:
        event = {"messages": ["x" * 32_768] * 4 + ["remaining diagnostics"]}

        result = _scrub_console_log(logging.getLogger(__name__), "info", event)

        assert result == {"messages": ["x" * 32_768] * 4 + [REDACTED]}
        assert _scrub_console_log(
            logging.getLogger(__name__), "info", {"event": "next event"}
        ) == {"event": "next event"}


class TestProductionLogging:
    @pytest.mark.parametrize("structured", [False, True], ids=["stdlib", "structlog"])
    def test_scrubs_messages_fields_and_exceptions_before_rendering(
        self, structured: bool, mocker: MockerFixture
    ) -> None:
        configure = mocker.patch("logging.config.dictConfig")
        Production.configure_stdlib(logfire=False)
        formatter_options = configure.call_args.args[0]["formatters"]["polar"].copy()
        formatter_options.pop("()")
        output = StringIO()
        handler = logging.StreamHandler(output)
        handler.setFormatter(structlog.stdlib.ProcessorFormatter(**formatter_options))
        logger = logging.getLogger("scrubbing-verification")
        mocker.patch.object(logger, "level", logging.INFO)
        mocker.patch.object(logger, "handlers", [handler])
        mocker.patch.object(logger, "propagate", False)

        try:
            raise ValueError("Rejected alice@example.com")
        except ValueError:
            if structured:
                structlog.wrap_logger(
                    logger, processors=Production.get_processors(logfire=False)
                ).exception(
                    "Failed for %s",
                    "alice@example.com",
                    customer_email="alice@example.com",
                )
            else:
                logger.exception(
                    "Failed for %s",
                    "alice@example.com",
                    extra={"customer_email": "alice@example.com"},
                )

        event = json.loads(output.getvalue())
        assert event["event"] == f"Failed for {REDACTED}"
        assert event["customer_email"] == REDACTED
        assert f"ValueError: Rejected {REDACTED}" in event["exception"]
        assert event["level"] == "error"
        assert event["logger"] == "scrubbing-verification"
        assert "alice@example.com" not in output.getvalue()
