from __future__ import annotations

from typing import TYPE_CHECKING

from pytest_mock import MockerFixture

from polar.sentry import before_send, configure_sentry

if TYPE_CHECKING:
    from sentry_sdk._types import Event


class TestBeforeSend:
    def test_strips_customer_email_from_checkout_confirmation(self) -> None:
        event: Event = {
            "request": {
                "url": (
                    "https://api.polar.sh/v1/checkouts/client/"
                    "polar_cst_secret/confirm?customer_email=buyer@gmail.com"
                ),
                "method": "POST",
                "query_string": "customer_email=buyer@gmail.com",
                "headers": {"User-Agent": "Checkout/1.0"},
                "env": {"REMOTE_ADDR": "203.0.113.10"},
                "data": {
                    "customer_email": "buyer@gmail.com",
                    "customer_name": "Buyer",
                    "customer_billing_address": {"line1": "1 Main St"},
                    "confirmation_token_id": "ctoken_123",
                },
            },
            "user": {"ip_address": "203.0.113.10"},
        }

        result = before_send(event, {})

        assert result is not None
        request = result["request"]
        assert "data" not in request
        assert "query_string" not in request
        assert request["headers"] == {"User-Agent": "Checkout/1.0"}
        assert request["env"] == {"REMOTE_ADDR": "203.0.113.10"}
        assert "buyer@gmail.com" not in str(request["url"])
        assert "polar_cst_secret" not in str(request["url"])
        assert result["user"] == {"ip_address": "203.0.113.10"}

    def test_drops_operational_errors(self) -> None:
        event: Event = {
            "tags": {"is_operational_error": "true"},
            "request": {"data": {"customer_email": "buyer@gmail.com"}},
        }

        assert before_send(event, {}) is None


class TestConfigureSentry:
    def test_never_captures_request_bodies(self, mocker: MockerFixture) -> None:
        init = mocker.patch("polar.sentry.sentry_sdk.init")

        configure_sentry()

        assert init.call_args is not None
        assert init.call_args.kwargs["max_request_body_size"] == "never"
        assert init.call_args.kwargs["before_send"] is before_send
