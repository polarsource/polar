import uuid
from typing import Any

import pytest
from pydantic import ValidationError

from polar.event.schemas import EventCreateCustomer, EventCreateExternalCustomer


@pytest.mark.parametrize(
    "data",
    [
        {"external_customer_id": "CUSTOMER", "name": "EVENT"},
        {
            "external_customer_id": "CUSTOMER",
            "name": "EVENT",
            "metadata": {"key": "value"},
        },
        {
            "external_customer_id": "CUSTOMER",
            "name": "EVENT",
            "metadata": {"_cost": {"amount": 100, "currency": "usd"}},
        },
        {
            "external_customer_id": "CUSTOMER",
            "name": "EVENT",
            "metadata": {
                "_llm": {
                    "vendor": "mistral",
                    "model": "mistral-medium-2508",
                    "input_tokens": 10,
                    "output_tokens": 20,
                    "total_tokens": 30,
                },
                "key": "value",
            },
        },
    ],
)
def test_valid(data: dict[str, Any]) -> None:
    event = EventCreateExternalCustomer.model_validate(data)
    assert event.external_customer_id == data["external_customer_id"]


def test_invalid_metadata_value_too_long() -> None:
    with pytest.raises(ValidationError):
        EventCreateExternalCustomer.model_validate(
            {
                "external_customer_id": "CUSTOMER",
                "name": "EVENT",
                "metadata": {"key": "a" * 600},
            }
        )


def test_invalid_cost_metadata() -> None:
    with pytest.raises(ValidationError) as e:
        EventCreateExternalCustomer.model_validate(
            {
                "external_customer_id": "CUSTOMER",
                "name": "EVENT",
                "metadata": {"_cost": {"amount": 1, "currency": "eur"}},
            }
        )

    errors = e.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("metadata", "_cost", "currency")
    assert errors[0]["type"] == "string_pattern_mismatch"


def test_invalid_llm_metadata() -> None:
    with pytest.raises(ValidationError) as e:
        EventCreateExternalCustomer.model_validate(
            {
                "external_customer_id": "CUSTOMER",
                "name": "EVENT",
                "metadata": {
                    "_llm": {
                        "vendor": "mistral",
                        "model": "mistral-medium-2508",
                        "input_tokens": 10,
                        "output_tokens": 20,
                    },
                    "key": "value",
                },
            }
        )

    errors = e.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("metadata", "_llm", "total_tokens")
    assert errors[0]["type"] == "missing"


class TestMemberFields:
    def test_external_customer_with_external_member_id(self) -> None:
        event = EventCreateExternalCustomer.model_validate(
            {
                "external_customer_id": "CUSTOMER",
                "name": "EVENT",
                "external_member_id": "MEMBER_123",
            }
        )
        assert event.external_member_id == "MEMBER_123"

    def test_external_customer_without_external_member_id(self) -> None:
        event = EventCreateExternalCustomer.model_validate(
            {
                "external_customer_id": "CUSTOMER",
                "name": "EVENT",
            }
        )
        assert event.external_member_id is None

    def test_customer_with_member_id(self) -> None:
        member_id = uuid.uuid4()
        customer_id = uuid.uuid4()
        event = EventCreateCustomer.model_validate(
            {
                "customer_id": str(customer_id),
                "name": "EVENT",
                "member_id": str(member_id),
            }
        )
        assert event.member_id == member_id

    def test_customer_without_member_id(self) -> None:
        customer_id = uuid.uuid4()
        event = EventCreateCustomer.model_validate(
            {
                "customer_id": str(customer_id),
                "name": "EVENT",
            }
        )
        assert event.member_id is None
