from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import CustomField, Product


class ProductCustomField(RecordModel):
    __tablename__ = "product_custom_fields"
    __table_args__ = (UniqueConstraint("product_id", "order"),)

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        primary_key=True,
    )
    custom_field_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("custom_fields.id", ondelete="cascade"),
        primary_key=True,
    )
    order: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship(
            "Product", lazy="raise", back_populates="product_custom_fields"
        )

    @declared_attr
    def custom_field(cls) -> Mapped["CustomField"]:
        # This is an association table, so eager loading makes sense
        return relationship("CustomField", lazy="joined")
