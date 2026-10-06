import uuid
from typing import Any, get_args, get_type_hints

import pytest
from pydantic import ValidationError

from polar.event.schemas import EventCreateCustomer, EventCreateExternalCustomer
from polar.event.schemas import SystemEvent as SystemEventUnion
from polar.event.system import SYSTEM_EVENT_LABELS
from polar.event.system import SystemEvent as SystemEventEnum


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


CUSTOMER_SEGMENT = {"external_customer_id": "CUSTOMER"}
MEMBER_SEGMENT = {"external_member_id": "MEMBER"}
TEAM_SEGMENT = {"external_entity_id": "TEAM"}
AGENT_SEGMENT = {"external_entity_id": "AGENT"}


class TestActorPath:
    @pytest.mark.parametrize(
        ("external_member_id", "actors"),
        [
            (None, [CUSTOMER_SEGMENT]),
            (None, [CUSTOMER_SEGMENT, TEAM_SEGMENT, AGENT_SEGMENT]),
            ("MEMBER", [CUSTOMER_SEGMENT, MEMBER_SEGMENT]),
            ("MEMBER", [CUSTOMER_SEGMENT, MEMBER_SEGMENT, AGENT_SEGMENT]),
            ("MEMBER", [CUSTOMER_SEGMENT, TEAM_SEGMENT, MEMBER_SEGMENT]),
            (
                "MEMBER",
                [CUSTOMER_SEGMENT, TEAM_SEGMENT, MEMBER_SEGMENT, AGENT_SEGMENT],
            ),
        ],
    )
    def test_valid(
        self, external_member_id: str | None, actors: list[dict[str, str]]
    ) -> None:
        event = EventCreateExternalCustomer.model_validate(
            {
                "external_customer_id": "CUSTOMER",
                "external_member_id": external_member_id,
                "name": "EVENT",
                "metadata": {"_actors": actors},
            }
        )
        assert event.metadata["_actors"] == actors

    @pytest.mark.parametrize(
        ("external_member_id", "actors"),
        [
            pytest.param(None, [], id="empty"),
            pytest.param(None, [TEAM_SEGMENT], id="customer not first"),
            pytest.param(
                None, [{"external_customer_id": "OTHER"}], id="customer mismatch"
            ),
            pytest.param(
                None, [CUSTOMER_SEGMENT, CUSTOMER_SEGMENT], id="two customers"
            ),
            pytest.param(
                None, [CUSTOMER_SEGMENT, MEMBER_SEGMENT], id="member not declared"
            ),
            pytest.param("MEMBER", [CUSTOMER_SEGMENT], id="member missing"),
            pytest.param(
                "MEMBER",
                [CUSTOMER_SEGMENT, {"external_member_id": "OTHER"}],
                id="member mismatch",
            ),
            pytest.param(
                "MEMBER",
                [CUSTOMER_SEGMENT, TEAM_SEGMENT, AGENT_SEGMENT, MEMBER_SEGMENT],
                id="member too deep",
            ),
            pytest.param(
                "MEMBER",
                [CUSTOMER_SEGMENT, MEMBER_SEGMENT, MEMBER_SEGMENT],
                id="two members",
            ),
            pytest.param(
                "MEMBER",
                [
                    CUSTOMER_SEGMENT,
                    {"external_entity_id": "TEAM", "external_member_id": "MEMBER"},
                ],
                id="mixed segment",
            ),
            pytest.param(None, ["CUSTOMER"], id="string segment"),
        ],
    )
    def test_invalid(self, external_member_id: str | None, actors: list[Any]) -> None:
        with pytest.raises(ValidationError):
            EventCreateExternalCustomer.model_validate(
                {
                    "external_customer_id": "CUSTOMER",
                    "external_member_id": external_member_id,
                    "name": "EVENT",
                    "metadata": {"_actors": actors},
                }
            )

    def test_internal_customer_rejected(self) -> None:
        with pytest.raises(ValidationError):
            EventCreateCustomer.model_validate(
                {
                    "customer_id": str(uuid.uuid4()),
                    "name": "EVENT",
                    "metadata": {"_actors": [CUSTOMER_SEGMENT]},
                }
            )


def _get_schema_union_event_names() -> set[str]:
    """Extract all event name literals covered by the SystemEvent schema union."""
    union_type = get_args(SystemEventUnion)[0]
    names: set[str] = set()
    for cls in get_args(union_type):
        hints = get_type_hints(cls, include_extras=True)
        name_hint = hints["name"]
        literal_args = get_args(name_hint)
        if not literal_args:
            literal_args = get_args(get_args(name_hint)[0])
        names.add(literal_args[0])
    return names


class TestSystemEventCoverage:
    def test_all_enum_values_in_schema_union(self) -> None:
        covered = _get_schema_union_event_names()
        all_events = {e.value for e in SystemEventEnum}
        missing = all_events - covered
        assert not missing, (
            f"SystemEvent enum values missing from schema union: {missing}"
        )

    def test_all_enum_values_in_labels(self) -> None:
        all_events = {e.value for e in SystemEventEnum}
        missing = all_events - set(SYSTEM_EVENT_LABELS.keys())
        assert not missing, (
            f"SystemEvent enum values missing from SYSTEM_EVENT_LABELS: {missing}"
        )
