from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Checkout, Product


class CheckoutProduct(RecordModel):
    __tablename__ = "checkout_products"
    __table_args__ = (UniqueConstraint("checkout_id", "order"),)

    checkout_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("checkouts.id", ondelete="cascade"),
        primary_key=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        primary_key=True,
    )
    order: Mapped[int] = mapped_column(Integer, index=True, nullable=False)

    @declared_attr
    def checkout(cls) -> Mapped["Checkout"]:
        # This is an association table, so eager loading makes sense
        return relationship("Checkout", back_populates="checkout_products")

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        # This is an association table, so eager loading makes sense
        return relationship("Product", lazy="joined")
