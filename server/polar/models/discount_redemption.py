from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Checkout, Customer, Discount, Subscription


class DiscountRedemption(RecordModel):
    __tablename__ = "discount_redemptions"

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

    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="set null"), nullable=True, index=True
    )

    customer_email: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer | None"]:
        return relationship("Customer", lazy="raise")
