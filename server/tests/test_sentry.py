from typing import Any, cast

import pytest

from polar.sentry import _REQUEST_PII_KEYS, before_send

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
    def test_pops_pii_keys_and_keeps_the_rest(self) -> None:
        event = {
            "request": {
                "url": "https://api.polar.sh/v1/checkouts/client/secret/confirm?customer_email=buyer@example.com",
                "method": "POST",
                "query_string": "customer_email=buyer@example.com",
                "data": {
                    **{key: "pii" for key in _REQUEST_PII_KEYS},
                    "amount": 1000,
                    "confirmation_token_id": "ctoken_123",
                    "customer_ip_address": "203.0.113.5",
                    "billing_address_fields": {
                        "line1": "required",
                        "country": "required",
                    },
                    "owner": {"email": "owner@example.com", "external_id": "usr_1"},
                },
                "headers": {"User-Agent": "Mozilla/5.0"},
                "env": {"REMOTE_ADDR": "198.51.100.10"},
            }
        }

        result = before_send(cast(Any, event), {})

        assert result is not None
        request = cast(dict[str, Any], result["request"])
        data = cast(dict[str, Any], request["data"])
        for key in _REQUEST_PII_KEYS:
            assert key not in data
        owner = cast(dict[str, Any], data["owner"])
        assert "email" not in owner
        assert owner["external_id"] == "usr_1"
        assert data["billing_address_fields"] == {
            "line1": "required",
            "country": "required",
        }
        assert data["amount"] == 1000
        assert data["confirmation_token_id"] == "ctoken_123"
        assert data["customer_ip_address"] == "203.0.113.5"
        assert "query_string" not in request
        assert "customer_email" not in str(request["url"])
        assert request["method"] == "POST"
        assert request["headers"]["User-Agent"] == "Mozilla/5.0"
        assert request["env"]["REMOTE_ADDR"] == "198.51.100.10"

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
