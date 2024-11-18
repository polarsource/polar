from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Discount, Product


class DiscountProduct(RecordModel):
    __tablename__ = "discount_products"

    discount_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("discounts.id", ondelete="cascade"),
        primary_key=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        primary_key=True,
    )

    @declared_attr
    def discount(cls) -> Mapped["Discount"]:
        return relationship(
            "Discount", lazy="raise", back_populates="discount_products"
        )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        # This is an association table, so eager loading makes sense
        return relationship("Product", lazy="joined")
