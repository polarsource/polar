from typing import Any

from polar_sdk.models import EventCreateExternalCustomer

from polar.validation import validate_event


def _event(**overrides: Any) -> EventCreateExternalCustomer:
    data: dict[str, Any] = {
        "name": "usage",
        "external_customer_id": "cus_1",
        "external_id": "evt_1",
    }
    data.update(overrides)
    return EventCreateExternalCustomer.model_validate(data)


def test_valid_event_has_no_errors() -> None:
    assert validate_event(0, _event()) == []


def test_omitted_timestamp_is_accepted() -> None:
    assert validate_event(0, _event()) == []


def test_past_aware_timestamp_is_accepted() -> None:
    assert validate_event(0, _event(timestamp="2020-01-01T00:00:00Z")) == []


def test_missing_external_id_is_rejected() -> None:
    event = EventCreateExternalCustomer.model_validate(
        {"name": "usage", "external_customer_id": "cus_1"}
    )
    errors = validate_event(0, event)
    assert [e["type"] for e in errors] == ["missing"]
    assert errors[0]["loc"] == ["body", "events", 0, "external_id"]


def test_organization_id_is_rejected() -> None:
    errors = validate_event(0, _event(organization_id="org_test"))
    assert any(
        e["type"] == "organization_token" and e["loc"][-1] == "organization_id"
        for e in errors
    )


def test_name_too_long_is_rejected() -> None:
    errors = validate_event(0, _event(name="x" * 129))
    assert any(
        e["type"] == "string_too_long" and e["loc"][-1] == "name" for e in errors
    )


def test_naive_timestamp_is_rejected() -> None:
    errors = validate_event(0, _event(timestamp="2020-01-01T00:00:00"))
    assert any(e["type"] == "timezone_aware" for e in errors)


def test_future_timestamp_is_rejected() -> None:
    errors = validate_event(0, _event(timestamp="2999-01-01T00:00:00Z"))
    assert any(
        e["type"] == "value_error" and e["loc"][-1] == "timestamp" for e in errors
    )
