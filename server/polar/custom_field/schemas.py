from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, Field, StringConstraints, TypeAdapter

from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import (
    ClassName,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.custom_field import (
    CustomFieldCheckboxProperties,
    CustomFieldDateProperties,
    CustomFieldNumberProperties,
    CustomFieldSelectProperties,
    CustomFieldTextProperties,
    CustomFieldType,
)
from polar.organization.schemas import OrganizationID

Slug = Annotated[
    str,
    StringConstraints(to_lower=True, min_length=1, pattern=r"^[a-z0-9-_]+$"),
    Field(
        description=(
            "Identifier of the custom field. "
            "It'll be used as key when storing the value. "
            "Must be unique across the organization."
            "It can only contain ASCII letters, numbers and hyphens."
        ),
        min_length=1,
    ),
]
Name = Annotated[str, Field(description="Name of the custom field.", min_length=1)]


class CustomFieldCreateBase(MetadataInputMixin, Schema):
    """Schema to create a new custom field."""

    type: CustomFieldType = Field(description="Data type of the custom field.")
    slug: Slug
    name: Name
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the custom field. "
            "**Required unless you use an organization token.**"
        ),
    )


class CustomFieldCreateText(CustomFieldCreateBase):
    """Schema to create a custom field of type text."""

    type: Literal[CustomFieldType.text]
    properties: CustomFieldTextProperties


class CustomFieldCreateNumber(CustomFieldCreateBase):
    """Schema to create a custom field of type number."""

    type: Literal[CustomFieldType.number]
    properties: CustomFieldNumberProperties


class CustomFieldCreateDate(CustomFieldCreateBase):
    """Schema to create a custom field of type date."""

    type: Literal[CustomFieldType.date]
    properties: CustomFieldDateProperties


class CustomFieldCreateCheckbox(CustomFieldCreateBase):
    """Schema to create a custom field of type checkbox."""

    type: Literal[CustomFieldType.checkbox]
    properties: CustomFieldCheckboxProperties


class CustomFieldCreateSelect(CustomFieldCreateBase):
    """Schema to create a custom field of type select."""

    type: Literal[CustomFieldType.select]
    properties: CustomFieldSelectProperties


CustomFieldCreate = Annotated[
    CustomFieldCreateText
    | CustomFieldCreateNumber
    | CustomFieldCreateDate
    | CustomFieldCreateCheckbox
    | CustomFieldCreateSelect,
    Discriminator("type"),
    SetSchemaReference("CustomFieldCreate"),
]


class CustomFieldUpdateBase(MetadataInputMixin, Schema):
    """Schema to update an existing custom field."""

    name: Name | None = None
    slug: Slug | None = None


class CustomFieldUpdateText(CustomFieldUpdateBase):
    """Schema to update a custom field of type text."""

    type: Literal[CustomFieldType.text]
    properties: CustomFieldTextProperties | None = None


class CustomFieldUpdateNumber(CustomFieldUpdateBase):
    """Schema to update a custom field of type number."""

    type: Literal[CustomFieldType.number]
    properties: CustomFieldNumberProperties | None = None


class CustomFieldUpdateDate(CustomFieldUpdateBase):
    """Schema to update a custom field of type date."""

    type: Literal[CustomFieldType.date]
    properties: CustomFieldDateProperties | None = None


class CustomFieldUpdateCheckbox(CustomFieldUpdateBase):
    """Schema to update a custom field of type checkbox."""

    type: Literal[CustomFieldType.checkbox]
    properties: CustomFieldCheckboxProperties | None = None


class CustomFieldUpdateSelect(CustomFieldUpdateBase):
    """Schema to update a custom field of type select."""

    type: Literal[CustomFieldType.select]
    properties: CustomFieldSelectProperties | None = None


CustomFieldUpdate = Annotated[
    CustomFieldUpdateText
    | CustomFieldUpdateNumber
    | CustomFieldUpdateDate
    | CustomFieldUpdateCheckbox
    | CustomFieldUpdateSelect,
    Discriminator("type"),
    SetSchemaReference("CustomFieldUpdate"),
]


class CustomFieldBase(MetadataOutputMixin, IDSchema, TimestampedSchema):
    """Schema for a custom field."""

    type: CustomFieldType = Field(description="Data type of the custom field.")
    slug: str = Field(
        description="Identifier of the custom field. "
        "It'll be used as key when storing the value."
    )
    name: str = Field(description="Name of the custom field.")
    organization_id: OrganizationID = Field(
        description="The ID of the organization owning the custom field."
    )


class CustomFieldText(CustomFieldBase):
    """Schema for a custom field of type text."""

    type: Literal[CustomFieldType.text]
    properties: CustomFieldTextProperties


class CustomFieldNumber(CustomFieldBase):
    """Schema for a custom field of type number."""

    type: Literal[CustomFieldType.number]
    properties: CustomFieldNumberProperties


class CustomFieldDate(CustomFieldBase):
    """Schema for a custom field of type date."""

    type: Literal[CustomFieldType.date]
    properties: CustomFieldDateProperties


class CustomFieldCheckbox(CustomFieldBase):
    """Schema for a custom field of type checkbox."""

    type: Literal[CustomFieldType.checkbox]
    properties: CustomFieldCheckboxProperties


class CustomFieldSelect(CustomFieldBase):
    """Schema for a custom field of type select."""

    type: Literal[CustomFieldType.select]
    properties: CustomFieldSelectProperties


CustomField = Annotated[
    CustomFieldText
    | CustomFieldNumber
    | CustomFieldDate
    | CustomFieldCheckbox
    | CustomFieldSelect,
    Discriminator("type"),
    SetSchemaReference("CustomField"),
    MergeJSONSchema({"title": "CustomField"}),
    ClassName("CustomField"),
]

CustomFieldAdapter: TypeAdapter[CustomField] = TypeAdapter(CustomField)


class AttachedCustomField(Schema):
    """Schema of a custom field attached to a resource."""

    custom_field_id: UUID4 = Field(description="ID of the custom field.")
    custom_field: CustomField
    order: int = Field(description="Order of the custom field in the resource.")
    required: bool = Field(
        description="Whether the value is required for this custom field."
    )


class AttachedCustomFieldCreate(Schema):
    """Schema to attach a custom field to a resource."""

    custom_field_id: UUID4 = Field(description="ID of the custom field to attach.")
    required: bool = Field(
        description="Whether the value is required for this custom field."
    )


AttachedCustomFieldListCreate = Annotated[
    list[AttachedCustomFieldCreate],
    Field(description="List of custom fields to attach."),
]
