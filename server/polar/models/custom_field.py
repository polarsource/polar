from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Annotated, Any, Literal, NotRequired, TypedDict
from uuid import UUID

from annotated_types import Ge, Le, Len, MinLen
from pydantic import AfterValidator, Field, ValidationInfo
from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import Organization

INT32_MIN = -(2**31)
INT32_MAX = 2**31 - 1


class CustomFieldType(StrEnum):
    text = "text"
    number = "number"
    date = "date"
    checkbox = "checkbox"
    select = "select"

    def get_model(self) -> type["CustomField"]:
        return {
            CustomFieldType.text: CustomFieldText,
            CustomFieldType.number: CustomFieldNumber,
            CustomFieldType.date: CustomFieldDate,
            CustomFieldType.checkbox: CustomFieldCheckbox,
            CustomFieldType.select: CustomFieldSelect,
        }[self]


PositiveBoundedInt = Annotated[int, Ge(0), Le(INT32_MAX)]
BoundedInt = Annotated[int, Ge(INT32_MIN), Le(INT32_MAX)]
NonEmptyString = Annotated[str, Len(min_length=1)]


def validate_ge_le(v: int, info: ValidationInfo) -> int:
    """Validate that le is greater than or equal to ge when both are provided."""
    ge = info.data.get("ge")
    if ge is not None and v is not None and ge > v:
        raise ValueError(
            "Greater than or equal (ge) must be less than or equal to "
            "Less than or equal (le)"
        )
    return v


class CustomFieldProperties(TypedDict):
    form_label: NotRequired[NonEmptyString]
    form_help_text: NotRequired[NonEmptyString]
    form_placeholder: NotRequired[NonEmptyString]


class CustomFieldTextProperties(CustomFieldProperties):
    textarea: NotRequired[bool]
    min_length: NotRequired[PositiveBoundedInt]
    max_length: NotRequired[PositiveBoundedInt]


class ComparableProperties(TypedDict):
    ge: NotRequired[BoundedInt]
    le: NotRequired[Annotated[BoundedInt, AfterValidator(validate_ge_le)]]


class CustomFieldNumberProperties(CustomFieldProperties, ComparableProperties):
    pass


class CustomFieldDateProperties(CustomFieldProperties, ComparableProperties):
    pass


class CustomFieldCheckboxProperties(CustomFieldProperties):
    pass


class CustomFieldSelectOption(TypedDict):
    value: NonEmptyString
    label: NonEmptyString


class CustomFieldSelectProperties(CustomFieldProperties):
    options: Annotated[list[CustomFieldSelectOption], MinLen(1)]


class CustomField(MetadataMixin, RecordModel):
    __tablename__ = "custom_fields"
    __table_args__ = (UniqueConstraint("slug", "organization_id"),)

    type: Mapped[CustomFieldType] = mapped_column(String, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(
        CITEXT,
        nullable=False,
        # Don't create an index for slug
        # as it's covered by the unique constraint, being the leading column of it
        index=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    properties: Mapped[CustomFieldProperties] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    def get_field_definition(self, required: bool) -> tuple[Any, Any]:
        raise NotImplementedError()

    __mapper_args__ = {
        "polymorphic_on": "type",
    }


class CustomFieldText(CustomField):
    type: Mapped[Literal[CustomFieldType.text]] = mapped_column(
        use_existing_column=True
    )
    properties: Mapped[CustomFieldTextProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.text,
        "polymorphic_load": "inline",
    }

    def get_field_definition(self, required: bool) -> tuple[Any, Any]:
        return (
            str if required else str | None,
            Field(
                default=None if not required else ...,
                min_length=self.properties.get("min_length"),
                max_length=self.properties.get("max_length"),
            ),
        )


class CustomFieldNumber(CustomField):
    type: Mapped[Literal[CustomFieldType.number]] = mapped_column(
        use_existing_column=True
    )
    properties: Mapped[CustomFieldNumberProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.number,
        "polymorphic_load": "inline",
    }

    def get_field_definition(self, required: bool) -> tuple[Any, Any]:
        ge = self.properties.get("ge")
        le = self.properties.get("le")
        return (
            int if required else int | None,
            Field(
                default=None if not required else ...,
                ge=ge if ge is not None else INT32_MIN,
                le=le if le is not None else INT32_MAX,
            ),
        )


class CustomFieldDate(CustomField):
    type: Mapped[Literal[CustomFieldType.date]] = mapped_column(
        use_existing_column=True
    )
    properties: Mapped[CustomFieldDateProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.date,
        "polymorphic_load": "inline",
    }

    def get_field_definition(self, required: bool) -> tuple[Any, Any]:
        ge = self.properties.get("ge")
        ge_date = datetime.fromtimestamp(ge).date() if ge else None
        le = self.properties.get("le")
        le_date = datetime.fromtimestamp(le).date() if le else None
        return (
            datetime if required else datetime | None,
            Field(default=None if not required else ..., ge=ge_date, le=le_date),
        )


class CustomFieldCheckbox(CustomField):
    type: Mapped[Literal[CustomFieldType.checkbox]] = mapped_column(
        use_existing_column=True
    )
    properties: Mapped[CustomFieldCheckboxProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.checkbox,
        "polymorphic_load": "inline",
    }

    def get_field_definition(self, required: bool) -> tuple[Any, Any]:
        return (
            Literal[True] if required else bool,
            Field(default=False if not required else ...),
        )


class CustomFieldSelect(CustomField):
    type: Mapped[Literal[CustomFieldType.select]] = mapped_column(
        use_existing_column=True
    )
    properties: Mapped[CustomFieldSelectProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.select,
        "polymorphic_load": "inline",
    }

    def get_field_definition(self, required: bool) -> tuple[Any, Any]:
        literal_type = Literal[  # type: ignore
            tuple(option["value"] for option in self.properties["options"])
        ]
        return (
            literal_type if required else literal_type | None,  # pyright: ignore
            Field(
                default=None if not required else ...,
            ),
        )
