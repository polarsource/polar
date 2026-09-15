import json
from typing import TYPE_CHECKING

import sentry_sdk
from pytest_mock import MockerFixture
from sentry_sdk.transport import Transport

from polar.observability.pii import REDACTED
from polar.sentry import before_breadcrumb, before_send, configure_sentry

if TYPE_CHECKING:
    from sentry_sdk._types import Event


class TestBeforeSend:
    def test_operational_errors_still_dropped(self) -> None:
        assert before_send({"tags": {"is_operational_error": "true"}}, {}) is None

    def test_scrubs_payload_and_preserves_grouping(self) -> None:
        identifier = "12345678-1234-4123-8123-123456789012"
        url = "https://api.polar.sh/v1/checkouts/client/opaqueCheckoutCredential"
        event: Event = {
            "user": {"id": identifier, "email": "alice@example.com", "name": "Alice"},
            "tags": {"correlation_id": identifier},
            "fingerprint": ["{{ default }}", "checkout"],
            "extra": {
                "payment": {"processor_id": "pm_123", "fingerprint": "cardFingerprint"}
            },
            "request": {
                "url": url,
                "query_string": "token=opaqueQueryCredential",
                "cookies": {"session": "opaqueCookieCredential"},
                "data": '{"name":"Alice","token":"opaqueBodyCredential"}',
                "headers": {"Authorization": "opaqueAuthorization"},
                "method": "POST",
            },
            "exception": {
                "values": [
                    {
                        "type": "ValueError",
                        "value": "contact alice@example.com using sk_live_abc123",
                    }
                ]
            },
            "breadcrumbs": {"values": [{"category": "http", "data": {"url": url}}]},
        }

        result = before_send(event, {})
        assert result is not None
        assert result["user"] == {"id": identifier, "email": REDACTED, "name": REDACTED}
        assert result["tags"]["correlation_id"] == identifier
        assert result["fingerprint"] == event["fingerprint"]
        assert result["extra"]["payment"] == {
            "processor_id": REDACTED,
            "fingerprint": REDACTED,
        }
        assert result["request"] == {
            "url": REDACTED,
            "query_string": REDACTED,
            "cookies": REDACTED,
            "data": REDACTED,
            "headers": {"Authorization": REDACTED},
            "method": "POST",
        }
        assert (
            result["exception"]["values"][0]["value"]
            == f"contact {REDACTED} using {REDACTED}"
        )
        breadcrumbs = result["breadcrumbs"]
        assert isinstance(breadcrumbs, dict)
        assert breadcrumbs["values"][0]["data"]["url"] == REDACTED
        assert event["user"]["email"] == "alice@example.com"
        assert event["request"]["url"] == url


class TestSentryCapture:
    def test_configured_sdk_scrubs_before_transport(
        self, mocker: MockerFixture
    ) -> None:
        init = mocker.patch("polar.sentry.sentry_sdk.init")
        configure_sentry()
        options = dict(init.call_args.kwargs)
        assert options["before_breadcrumb"] is before_breadcrumb
        assert options["send_default_pii"] is False
        assert options["include_local_variables"] is False
        assert options["max_request_body_size"] == "never"
        assert options["traces_sample_rate"] is None
        transport = mocker.Mock(spec=Transport)
        options.update(
            dsn="https://public@example.com/1", integrations=[], transport=transport
        )
        private_name = "PII_CANARY_PERSON"
        url = "https://api.polar.sh/verify?token=opaqueCredential"
        with sentry_sdk.Client(**options) as client, sentry_sdk.new_scope() as scope:
            scope.set_client(client)
            scope.set_user({"id": "user-123", "email": "alice@example.com"})
            scope.add_breadcrumb(
                category="log",
                message="contact alice@example.com",
                data={"customer_name": private_name},
            )
            scope.add_breadcrumb(
                category="http",
                data={"url": url},
            )
            try:
                raise ValueError("failed for alice@example.com using sk_live_abc123")
            except ValueError as error:
                event_id = scope.capture_exception(error)

        assert event_id is not None
        transport.capture_envelope.assert_called_once()
        envelope = transport.capture_envelope.call_args.args[0]
        event = envelope.get_event()
        assert event is not None
        serialized = json.dumps(event)
        assert "alice@example.com" not in serialized
        assert "sk_live_abc123" not in serialized
        assert "opaqueCredential" not in serialized
        assert private_name not in serialized
        assert event["user"] == {"id": "user-123", "email": REDACTED}
        assert len(event["breadcrumbs"]["values"]) == 2
        exception = event["exception"]["values"][0]
        assert exception["type"] == "ValueError"
        assert exception["value"] == f"failed for {REDACTED} using {REDACTED}"
        assert exception["stacktrace"]["frames"]
        assert all("vars" not in frame for frame in exception["stacktrace"]["frames"])
