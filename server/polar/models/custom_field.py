from enum import StrEnum
from typing import TYPE_CHECKING, Annotated, NotRequired, TypedDict
from uuid import UUID

from annotated_types import Ge, Len
from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import Organization


class CustomFieldType(StrEnum):
    text = "text"
    number = "number"
    date = "date"
    checkbox = "checkbox"
    select = "select"


PositiveInt = Annotated[int, Ge(0)]
NonEmptyString = Annotated[str, Len(min_length=1)]


class CustomFieldProperties(TypedDict):
    form_label: NotRequired[NonEmptyString]
    form_help_text: NotRequired[NonEmptyString]
    form_placeholder: NotRequired[NonEmptyString]


class CustomFieldTextProperties(CustomFieldProperties):
    min_length: NotRequired[PositiveInt]
    max_length: NotRequired[PositiveInt]


class ComparableProperties(TypedDict):
    ge: NotRequired[int]
    le: NotRequired[int]


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
    options: list[CustomFieldSelectOption]


class CustomField(MetadataMixin, RecordModel):
    __tablename__ = "custom_fields"
    __table_args__ = (UniqueConstraint("slug", "organization_id"),)

    type: Mapped[CustomFieldType] = mapped_column(String, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(CITEXT, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    properties: Mapped[CustomFieldProperties] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    __mapper_args__ = {
        "polymorphic_on": "type",
    }


class CustomFieldText(CustomField):
    properties: Mapped[CustomFieldTextProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.text,
        "polymorphic_load": "inline",
    }


class CustomFieldNumber(CustomField):
    properties: Mapped[CustomFieldNumberProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.number,
        "polymorphic_load": "inline",
    }


class CustomFieldDate(CustomField):
    properties: Mapped[CustomFieldDateProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.date,
        "polymorphic_load": "inline",
    }


class CustomFieldCheckbox(CustomField):
    properties: Mapped[CustomFieldCheckboxProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.checkbox,
        "polymorphic_load": "inline",
    }


class CustomFieldSelect(CustomField):
    properties: Mapped[CustomFieldSelectProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": CustomFieldType.select,
        "polymorphic_load": "inline",
    }
