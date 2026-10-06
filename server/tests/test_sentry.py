from typing import Any, cast

import pytest

from polar.sentry import before_send

# before_send does not touch Postgres, MinIO, or the worker.
# Override the suite's autouse fixtures so this module can run without them.


@pytest.fixture(scope="session", autouse=True)
def empty_test_bucket(worker_id: str) -> None:
    return None


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database(worker_id: str) -> None:
    return None


@pytest.fixture(autouse=True)
def patch_middlewares() -> None:
    return None


@pytest.fixture(autouse=True)
def set_job_queue_manager_context() -> None:
    return None


@pytest.fixture(autouse=True)
def current_message() -> None:
    return None


class TestBeforeSend:
    def test_redacts_customer_details_and_keeps_the_rest(self) -> None:
        event = {
            "request": {
                "url": "https://api.polar.sh/v1/checkouts/client/secret/confirm?customer_email=buyer@example.com",
                "method": "POST",
                "query_string": "customer_email=buyer@example.com",
                "data": {
                    "customer_email": "buyer@example.com",
                    "customer_name": "Buyer",
                    "customer_billing_name": "Buyer LLC",
                    "customer_billing_address": {
                        "line1": "1 Main St",
                        "city": "New York",
                    },
                    "customer_tax_id": "123456789",
                    "billing_name": "Buyer LLC",
                    "billing_address": {"line1": "1 Main St"},
                    "tax_id": "123456789",
                    "name": "Pro",
                    "customer_ip_address": "203.0.113.5",
                    "confirmation_token_id": "ctoken_123",
                    "amount": 1000,
                },
                "headers": {"User-Agent": "Mozilla/5.0"},
                "env": {"REMOTE_ADDR": "198.51.100.10"},
            }
        }

        result = before_send(cast(Any, event), {})

        assert result is not None
        request = cast(dict[str, Any], result["request"])
        data = cast(dict[str, Any], request["data"])
        assert data["customer_email"] == "[Filtered]"
        assert data["customer_name"] == "[Filtered]"
        assert data["customer_billing_name"] == "[Filtered]"
        assert data["customer_billing_address"] == "[Filtered]"
        assert data["customer_tax_id"] == "[Filtered]"
        assert data["billing_name"] == "[Filtered]"
        assert data["billing_address"] == "[Filtered]"
        assert data["tax_id"] == "[Filtered]"
        assert data["name"] == "Pro"
        assert data["customer_ip_address"] == "203.0.113.5"
        assert data["confirmation_token_id"] == "ctoken_123"
        assert data["amount"] == 1000
        assert "query_string" not in request
        assert "customer_email" not in str(request["url"])
        assert request["method"] == "POST"
        assert request["headers"]["User-Agent"] == "Mozilla/5.0"
        assert request["env"]["REMOTE_ADDR"] == "198.51.100.10"

    def test_redacts_nested_customer_details(self) -> None:
        event = {
            "request": {
                "data": {
                    "items": [
                        {"customer_email": "list@example.com", "quantity": 1},
                    ]
                }
            }
        }

        result = before_send(cast(Any, event), {})

        assert result is not None
        data = cast(dict[str, Any], result["request"]["data"])
        items = cast(list[dict[str, Any]], data["items"])
        assert items[0]["customer_email"] == "[Filtered]"
        assert items[0]["quantity"] == 1

    def test_leaves_event_without_request(self) -> None:
        event: dict[str, object] = {"message": "failed"}

        result = before_send(cast(Any, event), {})

        assert result is not None
        assert "request" not in result

    def test_drops_operational_errors(self) -> None:
        event = {
            "tags": {"is_operational_error": "true"},
            "request": {"data": {"customer_email": "buyer@example.com"}},
        }

        assert before_send(cast(Any, event), {}) is None
