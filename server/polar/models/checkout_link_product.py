from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import CheckoutLink, Product


class CheckoutLinkProduct(RecordModel):
    __tablename__ = "checkout_link_products"
    __table_args__ = (UniqueConstraint("checkout_link_id", "order"),)

    checkout_link_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("checkout_links.id", ondelete="cascade"),
        primary_key=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        primary_key=True,
    )
    order: Mapped[int] = mapped_column(Integer, index=True, nullable=False)

    @declared_attr
    def checkout_link(cls) -> Mapped["CheckoutLink"]:
        return relationship("CheckoutLink", back_populates="checkout_link_products")

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        # This is an association table, so eager loading makes sense
        return relationship("Product", lazy="joined")
