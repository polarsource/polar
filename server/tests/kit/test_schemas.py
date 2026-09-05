from datetime import datetime
from typing import Any

import pytest
from pydantic import Field, ValidationError
from pydantic.json_schema import JsonSchemaMode

from polar.kit.schemas import Schema, TimestampedSchema


class StringSchema(Schema):
    value: str


class StringListSchema(Schema):
    value: list[str]


class StringDictSchema(Schema):
    value: dict[str, str]


class NonStringSchema(Schema):
    integer: int
    boolean: bool
    none: None


class AnySchema(Schema):
    value: Any


class TestJsonSchema:
    @pytest.mark.parametrize("mode", ["validation", "serialization"])
    def test_common_datetime_examples(self, mode: JsonSchemaMode) -> None:
        class DatetimeSchema(TimestampedSchema):
            timestamps: list[datetime]
            nested: TimestampedSchema
            example: datetime
            custom: datetime = Field(examples=["2025-01-01T00:00:00Z"])
            data: dict[str, str] = Field(examples=[{"format": "date-time"}])

        schema = DatetimeSchema.model_json_schema(mode=mode)
        properties = schema["properties"]

        for field in (
            properties["created_at"],
            properties["modified_at"]["anyOf"][0],
            properties["timestamps"]["items"],
            properties["example"],
            schema["$defs"]["TimestampedSchema"]["properties"]["created_at"],
        ):
            assert field["examples"] == ["2026-01-01T00:00:00.123456Z"]
        assert properties["custom"]["examples"] == ["2025-01-01T00:00:00Z"]
        assert properties["data"]["examples"] == [{"format": "date-time"}]


def test_rejects_nul_character_in_string() -> None:
    with pytest.raises(ValidationError, match="This value contains invalid characters"):
        StringSchema(value="invalid\x00string")


def test_rejects_nul_character_in_list() -> None:
    with pytest.raises(ValidationError, match="This value contains invalid characters"):
        StringListSchema(value=["valid", "invalid\x00string"])


@pytest.mark.parametrize(
    "value",
    [
        {"invalid\x00key": "valid"},
        {"valid": "invalid\x00value"},
    ],
)
def test_rejects_nul_character_in_dict(value: dict[str, str]) -> None:
    with pytest.raises(ValidationError, match="This value contains invalid characters"):
        StringDictSchema(value=value)


def test_accepts_valid_strings_and_collections() -> None:
    assert StringSchema(value="valid").value == "valid"
    assert StringListSchema(value=["valid", "strings"]).value == ["valid", "strings"]
    assert StringDictSchema(value={"valid": "strings"}).value == {"valid": "strings"}


def test_leaves_non_string_fields_unchanged() -> None:
    schema = NonStringSchema(integer=42, boolean=True, none=None)

    assert schema.integer == 42
    assert schema.boolean is True
    assert schema.none is None


def test_handles_circular_collections() -> None:
    circular_dict: dict[str, Any] = {}
    circular_dict["self"] = circular_dict
    circular_list: list[Any] = []
    circular_list.append(circular_list)

    assert AnySchema(value=circular_dict).value is circular_dict
    assert AnySchema(value=circular_list).value is circular_list


def test_rejects_nul_character_in_circular_collection() -> None:
    circular_dict: dict[str, Any] = {"invalid": "invalid\x00string"}
    circular_dict["self"] = circular_dict

    with pytest.raises(ValidationError, match="This value contains invalid characters"):
        AnySchema(value=circular_dict)
