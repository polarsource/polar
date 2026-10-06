from typing import Any

from polar.sentry import before_send


class TestBeforeSend:
    def test_redacts_customer_billing_address_street_and_postal_code(self) -> None:
        event: Any = {
            "request": {
                "url": "https://api.polar.sh/v1/checkouts/client/secret/confirm?foo=bar",
                "query_string": "foo=bar",
                "fragment": "section",
                "headers": {"User-Agent": "Mozilla/5.0"},
                "env": {"REMOTE_ADDR": "203.0.113.4"},
                "data": {
                    "confirmation_token_id": "ctoken_123",
                    "customer_billing_name": "Ada Lovelace",
                    "customer_billing_address": {
                        "line1": "1 Test Street",
                        "line2": "Unit 2",
                        "postal_code": "00000",
                        "city": "Testville",
                        "state": "CA-AB",
                        "country": "CA",
                    },
                },
            }
        }

        result = before_send(event, {})

        assert result is not None
        assert "query_string" not in result["request"]
        assert "fragment" not in result["request"]
        assert result["request"]["headers"] == {"User-Agent": "Mozilla/5.0"}
        assert result["request"]["env"] == {"REMOTE_ADDR": "203.0.113.4"}
        data = result["request"]["data"]
        assert isinstance(data, dict)
        address = data["customer_billing_address"]
        assert isinstance(address, dict)
        assert data["confirmation_token_id"] == "ctoken_123"
        assert data["customer_billing_name"] == "Ada Lovelace"
        assert address["line1"] == "[Filtered]"
        assert address["line2"] == "[Filtered]"
        assert address["postal_code"] == "[Filtered]"
        assert address["city"] == "[Filtered]"
        assert address["state"] == "CA-AB"
        assert address["country"] == "CA"

    def test_leaves_request_without_billing_address(self) -> None:
        event: Any = {
            "request": {
                "headers": {"User-Agent": "checkout-client"},
                "env": {"REMOTE_ADDR": "203.0.113.4"},
                "data": {"confirmation_token_id": "ctoken_123"},
            }
        }

        result = before_send(event, {})

        assert result is not None
        assert result["request"]["data"] == {"confirmation_token_id": "ctoken_123"}
        assert result["request"]["headers"] == {"User-Agent": "checkout-client"}
        assert result["request"]["env"] == {"REMOTE_ADDR": "203.0.113.4"}

    def test_ignores_non_dict_request_data(self) -> None:
        event: Any = {
            "request": {
                "data": "[Unparsable]",
                "headers": {"User-Agent": "Mozilla/5.0"},
            }
        }

        result = before_send(event, {})

        assert result is not None
        assert result["request"]["data"] == "[Unparsable]"
        assert result["request"]["headers"] == {"User-Agent": "Mozilla/5.0"}

    def test_drops_operational_errors(self) -> None:
        event: Any = {
            "tags": {"is_operational_error": "true"},
            "request": {
                "data": {
                    "customer_billing_address": {
                        "line1": "1 Test Street",
                        "postal_code": "00000",
                        "country": "CA",
                    }
                }
            },
        }

        assert before_send(event, {}) is None
        assert (
            event["request"]["data"]["customer_billing_address"]["line1"]
            == "1 Test Street"
        )
