from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.custom_field.attachment import AttachedCustomFieldMixin
from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Product


class ProductCustomField(AttachedCustomFieldMixin, RecordModel):
    __tablename__ = "product_custom_fields"
    __table_args__ = (UniqueConstraint("product_id", "order"),)

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        primary_key=True,
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship(
            "Product", lazy="raise", back_populates="attached_custom_fields"
        )
