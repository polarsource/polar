from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError

from polar.custom_field.schemas import CustomFieldCreate, CustomFieldUpdate
from polar.models.custom_field import CustomFieldType

CustomFieldCreateAdapter: TypeAdapter[CustomFieldCreate] = TypeAdapter(
    CustomFieldCreate
)
CustomFieldUpdateAdapter: TypeAdapter[CustomFieldUpdate] = TypeAdapter(
    CustomFieldUpdate
)


@pytest.mark.parametrize(
    "input",
    [
        pytest.param({"slug": ""}, id="empty slug"),
        pytest.param({"slug": "aaa bbb"}, id="invalid slug 1"),
        pytest.param({"slug": "888!"}, id="invalid slug 2"),
        pytest.param({"name": ""}, id="empty name"),
        pytest.param({"properties": {"min_length": -1}}, id="negative min length"),
        pytest.param({"properties": {"max_length": -1}}, id="negative max length"),
        pytest.param({"type": "select", "properties": {}}, id="missing select options"),
        pytest.param(
            {"type": "select", "properties": {"options": [{"k": "a", "v": "b"}]}},
            id="invalid select options",
        ),
        pytest.param(
            {"type": "select", "properties": {"options": []}},
            id="empty select options",
        ),
    ],
)
def test_invalid_create(input: dict[str, Any]) -> None:
    base_input: dict[str, Any] = {
        "type": "text",
        "slug": "my-field",
        "name": "My field",
        "properties": {},
    }
    with pytest.raises(ValidationError):
        CustomFieldCreateAdapter.validate_python(
            {
                **base_input,
                **input,
                "properties": {
                    **base_input["properties"],
                    **input.get("properties", {}),
                },
            }
        )


@pytest.mark.parametrize(
    ("input", "expected_type"),
    [
        pytest.param({}, CustomFieldType.text, id="text"),
        pytest.param({"type": "number"}, CustomFieldType.number, id="number"),
        pytest.param({"type": "date"}, CustomFieldType.date, id="date"),
        pytest.param({"type": "checkbox"}, CustomFieldType.checkbox, id="checkbox"),
        pytest.param(
            {
                "type": "select",
                "properties": {
                    "options": [
                        {"value": "a", "label": "A"},
                        {"value": "b", "label": "B"},
                    ]
                },
            },
            CustomFieldType.select,
            id="select",
        ),
        pytest.param({"slug": "valid_slug"}, CustomFieldType.text, id="valid slug 1"),
        pytest.param({"slug": "_valid_slug2"}, CustomFieldType.text, id="valid slug 2"),
    ],
)
def test_valid_create(input: dict[str, Any], expected_type: CustomFieldType) -> None:
    base_input: dict[str, Any] = {
        "type": "text",
        "slug": "my-field",
        "name": "My field",
        "properties": {},
    }
    custom_field_create = CustomFieldCreateAdapter.validate_python(
        {
            **base_input,
            **input,
            "properties": {
                **base_input["properties"],
                **input.get("properties", {}),
            },
        }
    )
    assert custom_field_create.type == expected_type


@pytest.mark.parametrize(
    "properties",
    [
        pytest.param({"form_label": ""}, id="empty form label"),
        pytest.param({"form_help_text": ""}, id="empty form help text"),
        pytest.param({"form_placeholder": ""}, id="empty form placeholder"),
        pytest.param({"form_help_text": None}, id="null form help text"),
        pytest.param(
            {"form_label": "", "form_help_text": "", "form_placeholder": ""},
            id="all empty",
        ),
    ],
)
def test_create_unset_properties_stripped(properties: dict[str, Any]) -> None:
    custom_field_create = CustomFieldCreateAdapter.validate_python(
        {
            "type": "text",
            "slug": "my-field",
            "name": "My field",
            "properties": properties,
        }
    )
    assert custom_field_create.properties == {}


def test_update_unset_properties_stripped() -> None:
    custom_field_update = CustomFieldUpdateAdapter.validate_python(
        {
            "type": "text",
            "properties": {"form_label": "Label", "form_help_text": ""},
        }
    )
    assert custom_field_update.properties == {"form_label": "Label"}
