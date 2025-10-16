from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, Uuid, event
from sqlalchemy.orm import (
    Mapped,
    Mapper,
    declared_attr,
    mapped_column,
    relationship,
)

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


attached_custom_fields_models: set[type[AttachedCustomFieldMixin]] = set()


# Event listener to track models inheriting from AttachedCustomFieldMixin
@event.listens_for(Mapper, "mapper_configured")
def track_attached_custom_field_mixin(_mapper: Mapper[Any], class_: type) -> None:
    if issubclass(class_, AttachedCustomFieldMixin):
        attached_custom_fields_models.add(class_)
