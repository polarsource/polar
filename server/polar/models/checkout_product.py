from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Checkout, Product, ProductPrice


class CheckoutProduct(RecordModel):
    __tablename__ = "checkout_products"
    __table_args__ = (
        UniqueConstraint("checkout_id", "product_id"),
        UniqueConstraint("checkout_id", "order"),
    )

    checkout_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("checkouts.id", ondelete="cascade")
    )
    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="cascade")
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False)

    @declared_attr
    def checkout(cls) -> Mapped["Checkout"]:
        return relationship("Checkout", back_populates="checkout_products")

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        # This is an association table, so eager loading makes sense
        return relationship("Product", lazy="joined")

    @declared_attr
    def ad_hoc_prices(cls) -> Mapped[list["ProductPrice"]]:
        return relationship(
            "ProductPrice", lazy="selectin", back_populates="checkout_product"
        )
