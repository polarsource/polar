import typing

import pytest
import pytest_asyncio
from pydantic import BaseModel, ValidationError

from polar.custom_field.data import (
    build_custom_field_data_schema,
    custom_field_data_models,
)
from polar.models import Organization
from polar.models.custom_field import CustomFieldType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_custom_field


@pytest_asyncio.fixture
async def custom_field_data_schema(
    save_fixture: SaveFixture, organization: Organization
) -> type[BaseModel]:
    text_field = await create_custom_field(
        save_fixture,
        type=CustomFieldType.text,
        slug="text1",
        organization=organization,
    )
    number_field = await create_custom_field(
        save_fixture,
        type=CustomFieldType.number,
        slug="number1",
        organization=organization,
        properties={
            "ge": 0,
        },
    )
    select_field = await create_custom_field(
        save_fixture,
        type=CustomFieldType.select,
        slug="select1",
        organization=organization,
        properties={
            "options": [
                {"value": "a", "label": "A"},
                {"value": "b", "label": "B"},
            ],
        },
    )

    return build_custom_field_data_schema(
        [
            (text_field, True),
            (number_field, False),
            (select_field, False),
        ]
    )


@pytest.mark.parametrize(
    "input",
    [
        pytest.param({"text1": "abc", "number1": "abc"}, id="invalid number"),
        pytest.param({"text1": "abc", "number1": -1}, id="invalid number constraint"),
        pytest.param(
            {"text1": "abc", "number1": 2**32}, id="invalid number constraint"
        ),
        pytest.param({"text1": "abc", "select1": "c"}, id="invalid select"),
        pytest.param({"number1": 123, "select1": "c"}, id="missing required"),
    ],
)
def test_invalid_input(
    input: dict[str, typing.Any], custom_field_data_schema: type[BaseModel]
) -> None:
    with pytest.raises(ValidationError):
        custom_field_data_schema.model_validate(input)


@pytest.mark.parametrize(
    "input",
    [
        pytest.param({"text1": "abc"}, id="valid without optional"),
        pytest.param(
            {"text1": "abc", "number1": 123, "select1": "a"}, id="valid with optional"
        ),
    ],
)
def test_valid_input(
    input: dict[str, typing.Any], custom_field_data_schema: type[BaseModel]
) -> None:
    data = custom_field_data_schema.model_validate(input)
    assert data.model_dump(exclude_unset=True) == input


@pytest.mark.asyncio
async def test_checkbox_input(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    checkbox_field = await create_custom_field(
        save_fixture,
        type=CustomFieldType.checkbox,
        slug="checkbox1",
        organization=organization,
    )

    optional_schema = build_custom_field_data_schema([(checkbox_field, False)])

    data = optional_schema.model_validate({})
    assert getattr(data, "checkbox1") is False
    data = optional_schema.model_validate({"checkbox1": True})
    assert getattr(data, "checkbox1") is True
    data = optional_schema.model_validate({"checkbox1": False})
    assert getattr(data, "checkbox1") is False

    required_schema = build_custom_field_data_schema([(checkbox_field, True)])
    with pytest.raises(ValidationError):
        required_schema.model_validate({})
    with pytest.raises(ValidationError):
        required_schema.model_validate({"checkbox1": False})
    data = required_schema.model_validate({"checkbox1": True})
    assert getattr(data, "checkbox1") is True


def test_custom_field_data_models() -> None:
    for model in custom_field_data_models:
        assert hasattr(model, "organization"), (
            f"{model} should have an organization property "
            "so we can update custom fields properly"
        )
