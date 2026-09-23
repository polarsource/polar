from typing import TYPE_CHECKING

from polar.logging import REDACTED
from polar.sentry import before_send

if TYPE_CHECKING:
    from sentry_sdk._types import Event


class TestBeforeSend:
    def test_scrubs_exception_chain_and_event_messages(self) -> None:
        event: Event = {
            "exception": {
                "values": [
                    {"type": "ValueError", "value": "Rejected alice@example.com"},
                    {
                        "type": "RuntimeError",
                        "value": "Failed with token=secret123",
                        "stacktrace": {
                            "frames": [{"filename": "worker.py", "lineno": 42}]
                        },
                    },
                ]
            },
            "message": "Failed for alice@example.com",
            "logentry": {
                "message": "Failed for %s with card %s",
                "formatted": "Failed for alice@example.com with card 4242424242424242",
                "params": ["alice@example.com", 4242424242424242],
            },
            "breadcrumbs": {"values": [{"message": "Started for alice@example.com"}]},
        }

        result = before_send(event, {})

        assert result == {
            "exception": {
                "values": [
                    {"type": "ValueError", "value": f"Rejected {REDACTED}"},
                    {
                        "type": "RuntimeError",
                        "value": f"Failed with {REDACTED}",
                        "stacktrace": {
                            "frames": [{"filename": "worker.py", "lineno": 42}]
                        },
                    },
                ]
            },
            "message": f"Failed for {REDACTED}",
            "logentry": {
                "message": "Failed for %s with card %s",
                "formatted": f"Failed for {REDACTED} with card {REDACTED}",
            },
            "breadcrumbs": {"values": [{"message": f"Started for {REDACTED}"}]},
        }

    def test_prioritizes_latest_exception_with_shared_budget(self) -> None:
        event: Event = {
            "exception": {
                "values": [
                    {"value": "earlier cause"},
                    {"value": "x" * 8_192},
                    {"value": "y" * 8_192},
                ]
            },
            "message": "additional message",
            "logentry": {"formatted": "additional log message"},
            "breadcrumbs": {"values": [{"message": "earlier breadcrumb"}]},
        }

        result = before_send(event, {})

        assert result == {
            "exception": {
                "values": [
                    {"value": REDACTED},
                    {"value": "x" * 8_192},
                    {"value": "y" * 8_192},
                ]
            },
            "message": REDACTED,
            "logentry": {"formatted": REDACTED},
            "breadcrumbs": {"values": [{"message": REDACTED}]},
        }
        assert before_send({"message": "next error"}, {}) == {"message": "next error"}

    def test_filters_operational_errors(self) -> None:
        assert before_send({"tags": {"is_operational_error": "true"}}, {}) is None
