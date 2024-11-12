from collections.abc import Sequence
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, Field, ValidationError, create_model
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, Mapper, ORMDescriptor, mapped_column

from polar.exceptions import PolarRequestValidationError

if TYPE_CHECKING:
    from polar.models import CustomField, Organization

    from .attachment import AttachedCustomFieldMixin


class CustomFieldDataMixin:
    custom_field_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    # Make the type checker happy, but we should make sure actual models
    # declare an organization attribute by themselves.
    if TYPE_CHECKING:
        organization: ORMDescriptor["Organization"]


custom_field_data_models: set[type[CustomFieldDataMixin]] = set()


# Event listener to track models inheriting from CustomFieldDataMixin
@event.listens_for(Mapper, "mapper_configured")
def track_attached_custom_field_mixin(_mapper: Mapper[Any], class_: type) -> None:
    if issubclass(class_, CustomFieldDataMixin):
        custom_field_data_models.add(class_)


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
