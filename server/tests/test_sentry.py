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
    def test_removes_personal_fields_and_keeps_the_rest(self) -> None:
        event = {
            "request": {
                "url": "https://api.polar.sh/v1/checkouts/client/secret/confirm?customer_email=buyer@example.com",
                "method": "POST",
                "query_string": "customer_email=buyer@example.com",
                "data": {
                    "customer_email": "buyer@example.com",
                    "customer_name": "Test Buyer",
                    "customer_billing_name": "Test Buyer",
                    "customer_billing_address": {
                        "line1": "1 Test Street",
                        "postal_code": "00000",
                        "country": "CA",
                    },
                    "customer_tax_id": "FR61954506077",
                    "amount": 1000,
                    "confirmation_token_id": "ctoken_123",
                    "customer_ip_address": "203.0.113.5",
                    "billing_address_fields": {
                        "line1": "required",
                        "country": "required",
                    },
                },
                "headers": {"User-Agent": "Mozilla/5.0"},
                "env": {"REMOTE_ADDR": "198.51.100.10"},
            }
        }

        result = before_send(cast(Any, event), {})

        assert result is not None
        request = cast(dict[str, Any], result["request"])
        data = cast(dict[str, Any], request["data"])
        assert "customer_email" not in data
        assert "customer_name" not in data
        assert "customer_billing_name" not in data
        assert "customer_billing_address" not in data
        assert "customer_tax_id" not in data
        assert data["amount"] == 1000
        assert data["confirmation_token_id"] == "ctoken_123"
        assert data["customer_ip_address"] == "203.0.113.5"
        assert data["billing_address_fields"] == {
            "line1": "required",
            "country": "required",
        }
        assert "query_string" not in request
        assert "customer_email" not in str(request["url"])
        assert request["method"] == "POST"
        assert request["headers"]["User-Agent"] == "Mozilla/5.0"
        assert request["env"]["REMOTE_ADDR"] == "198.51.100.10"

    def test_removes_secrets_and_merchant_supplied_values(self) -> None:
        event = {
            "request": {
                "data": {
                    "access_token": "polar_at_xxx",
                    "api_key": "sk_test_xxx",
                    "client_secret": "polar_cs_xxx",
                    "cf-turnstile-response": "cf_xxx",
                    "code": "123456",
                    "customer_external_id": "buyer@example.com",
                    "customer_metadata": {"crm_contact": "buyer@example.com"},
                    "expo_push_token": "ExponentPushToken[xxx]",
                    "external_customer_id": "buyer@example.com",
                    "external_id": "buyer@example.com",
                    "invitation_token": "polar_it_xxx",
                    "metadata": {"crm_contact": "buyer@example.com"},
                    "refresh_token": "polar_rt_xxx",
                    "secret": "whsec_xxx",
                    "session_token": "polar_st_xxx",
                    "signing_secret": "slack_signing_xxx",
                    "token": "polar_oat_xxx",
                    "turnstile_token": "cf_xxx",
                    "product_id": "prod_123",
                    "grant_type": "authorization_code",
                }
            }
        }

        result = before_send(cast(Any, event), {})

        assert result is not None
        data = cast(dict[str, Any], cast(dict[str, Any], result["request"])["data"])
        assert "access_token" not in data
        assert "api_key" not in data
        assert "client_secret" not in data
        assert "cf-turnstile-response" not in data
        assert "code" not in data
        assert "customer_external_id" not in data
        assert "customer_metadata" not in data
        assert "expo_push_token" not in data
        assert "external_customer_id" not in data
        assert "external_id" not in data
        assert "invitation_token" not in data
        assert "metadata" not in data
        assert "refresh_token" not in data
        assert "secret" not in data
        assert "session_token" not in data
        assert "signing_secret" not in data
        assert "token" not in data
        assert "turnstile_token" not in data
        assert data["product_id"] == "prod_123"
        assert data["grant_type"] == "authorization_code"

    def test_removes_personal_fields_nested_in_lists(self) -> None:
        event = {
            "request": {
                "data": {
                    "members": [
                        {"email": "member@example.com", "role": "admin"},
                        {"invited_email": "invitee@example.com", "role": "member"},
                    ],
                    "prices": [[{"name": "Pro", "amount": 1000}]],
                }
            }
        }

        result = before_send(cast(Any, event), {})

        assert result is not None
        data = cast(dict[str, Any], cast(dict[str, Any], result["request"])["data"])
        assert data["members"] == [{"role": "admin"}, {"role": "member"}]
        assert data["prices"] == [[{"amount": 1000}]]

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

    def test_leaves_non_mapping_request_data(self) -> None:
        event = {"request": {"data": "raw-body"}}

        result = before_send(cast(Any, event), {})

        assert result is not None
        request = cast(dict[str, Any], result["request"])
        assert request["data"] == "raw-body"
