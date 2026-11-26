from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, Uuid, text
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Checkout, Discount, Order, Subscription


class DiscountRedemption(RecordModel):
    __tablename__ = "discount_redemptions"
    __table_args__ = (
        Index(
            "ix_discount_redemptions_order_id",
            "order_id",
            unique=True,
            postgresql_where=text("order_id IS NOT NULL"),
        ),
    )

    discount_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("discounts.id", ondelete="cascade"), index=True
    )

    @declared_attr
    def discount(cls) -> Mapped["Discount"]:
        return relationship(
            "Discount", lazy="raise", back_populates="discount_redemptions"
        )

    checkout_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("checkouts.id", ondelete="cascade"), index=True
    )

    @declared_attr
    def checkout(cls) -> Mapped["Checkout | None"]:
        return relationship("Checkout", lazy="raise")

    subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("subscriptions.id", ondelete="cascade"), index=True
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription | None"]:
        return relationship("Subscription", lazy="raise")

    order_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("orders.id", ondelete="cascade")
    )

    @declared_attr
    def order(cls) -> Mapped["Order | None"]:
        return relationship("Order", lazy="raise")
