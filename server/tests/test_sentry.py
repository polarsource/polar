from typing import TYPE_CHECKING

from polar.sentry import before_send

if TYPE_CHECKING:
    from sentry_sdk._types import Event


class TestBeforeSend:
    def test_scrubs_customer_billing_address_from_request_data(self) -> None:
        data: dict[str, object] = {
            "confirmation_token_id": "ctoken_123",
            "customer_billing_address": {
                "country": "CA",
                "line1": "1 Test Street",
                "postal_code": "T2P 0A1",
            },
            "customer_ip_address": "203.0.113.5",
        }
        event: Event = {
            "request": {
                "headers": {"User-Agent": "Mozilla/5.0"},
                "env": {"REMOTE_ADDR": "203.0.113.5"},
                "data": data,
            }
        }

        result = before_send(event, {})

        assert result is not None
        body = result["request"]["data"]
        assert isinstance(body, dict)
        assert "customer_billing_address" not in body
        assert body["confirmation_token_id"] == "ctoken_123"
        assert body["customer_ip_address"] == "203.0.113.5"
        headers = result["request"]["headers"]
        assert isinstance(headers, dict)
        assert headers["User-Agent"] == "Mozilla/5.0"
        env = result["request"]["env"]
        assert isinstance(env, dict)
        assert env["REMOTE_ADDR"] == "203.0.113.5"

    def test_leaves_non_mapping_request_data(self) -> None:
        event: Event = {"request": {"data": "raw-body"}}

        result = before_send(event, {})

        assert result is not None
        body = result["request"]["data"]
        assert isinstance(body, str)
        assert body == "raw-body"
