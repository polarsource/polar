from typing import TYPE_CHECKING
from uuid import UUID

from pydantic import Field
from sqlalchemy import Boolean, ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.schemas import Schema

from .schemas import CustomField as CustomFieldSchema

if TYPE_CHECKING:
    from polar.models import CustomField


class AttachedCustomFieldMixin:
    """Mixin for models that attach custom fields."""

    custom_field_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("custom_fields.id", ondelete="cascade"),
        primary_key=True,
    )
    order: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    @declared_attr
    def custom_field(cls) -> Mapped["CustomField"]:
        # This is an association table, so eager loading makes sense
        return relationship("CustomField", lazy="joined")


class AttachedCustomField(Schema):
    """Schema of a custom field attached to a resource."""

    custom_field: CustomFieldSchema
    order: int = Field(description="Order of the custom field in the resource.")
    required: bool = Field(
        description="Whether the value is required for this custom field."
    )
