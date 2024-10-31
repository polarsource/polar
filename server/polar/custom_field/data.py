from collections.abc import Sequence
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, Field, ValidationError, create_model
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.exceptions import PolarRequestValidationError

if TYPE_CHECKING:
    from polar.models import CustomField

    from .attachment import AttachedCustomFieldMixin


class CustomFieldDataMixin:
    custom_field_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )


class CustomFieldDataInputMixin(BaseModel):
    custom_field_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Key-value object storing custom field values.",
    )


class OptionalCustomFieldDataInputMixin(BaseModel):
    custom_field_data: dict[str, Any] | None = Field(
        default=None,
        description="Key-value object storing custom field values.",
    )


class CustomFieldDataOutputMixin(BaseModel):
    custom_field_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Key-value object storing custom field values.",
    )


def build_custom_field_data_schema(
    custom_fields: Sequence[tuple["CustomField", bool]],
) -> type[BaseModel]:
    fields_definitions: Any = {
        custom_field.slug: custom_field.get_field_definition(required)
        for custom_field, required in custom_fields
    }
    return create_model("CustomFieldDataInput", **fields_definitions)


def validate_custom_field_data(
    attached_custom_fields: Sequence["AttachedCustomFieldMixin"],
    data: dict[str, Any],
    *,
    error_loc_prefix: Sequence[str] = ("body", "custom_field_data"),
) -> dict[str, Any]:
    schema = build_custom_field_data_schema(
        [(f.custom_field, f.required) for f in attached_custom_fields]
    )
    try:
        return schema.model_validate(data).model_dump(mode="json")
    except ValidationError as e:
        raise PolarRequestValidationError(
            [{**err, "loc": (*error_loc_prefix, *err["loc"])} for err in e.errors()]  # pyright: ignore
        )
