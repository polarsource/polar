from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import Checkout, Product, ProductPrice, Subscription, User


class Order(MetadataMixin, RecordModel):
    __tablename__ = "orders"

    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    stripe_invoice_id: Mapped[str | None] = mapped_column(String, nullable=True)

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id"),
        nullable=False,
    )

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id"),
        nullable=False,
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise")

    product_price_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("product_prices.id"),
        nullable=False,
    )

    @declared_attr
    def product_price(cls) -> Mapped["ProductPrice"]:
        return relationship("ProductPrice", lazy="raise")

    subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id"),
        nullable=True,
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship("Subscription", lazy="raise")

    checkout_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("checkouts.id", ondelete="set null"), nullable=True, index=True
    )

    @declared_attr
    def checkout(cls) -> Mapped["Checkout | None"]:
        return relationship("Checkout", lazy="raise")
