from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.custom_field.data import CustomFieldDataMixin
from polar.kit.address import Address, AddressType
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import (
        Checkout,
        Customer,
        Discount,
        Organization,
        Product,
        ProductPrice,
        Refund,
        Subscription,
    )


class OrderBillingReason(StrEnum):
    purchase = "purchase"
    subscription_create = "subscription_create"
    subscription_cycle = "subscription_cycle"
    subscription_update = "subscription_update"


class OrderStatus(StrEnum):
    paid = "paid"
    refunded = "refunded"
    partially_refunded = "partially_refunded"


class Order(CustomFieldDataMixin, MetadataMixin, RecordModel):
    __tablename__ = "orders"

    status: Mapped[OrderStatus] = mapped_column(
        String, nullable=False, default=OrderStatus.paid
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    billing_reason: Mapped[OrderBillingReason] = mapped_column(
        String, nullable=False, index=True
    )

    refunded_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    refunded_tax_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    billing_address: Mapped[Address | None] = mapped_column(AddressType, nullable=True)
    stripe_invoice_id: Mapped[str | None] = mapped_column(
        String, nullable=True, unique=True
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id"),
        nullable=False,
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

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

    discount_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("discounts.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def discount(cls) -> Mapped["Discount | None"]:
        return relationship("Discount", lazy="raise")

    organization: AssociationProxy["Organization"] = association_proxy(
        "product", "organization"
    )

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

    @declared_attr
    def refunds(cls) -> Mapped[list["Refund"]]:
        return relationship(
            "Refund",
            lazy="selectin",
            primaryjoin=(
                "and_("
                "Refund.order_id == Order.id, "
                "Refund.status == 'succeeded'"
                ")"
            ),
            viewonly=True,
        )

    def set_refunded(self, refunded_amount: int, refunded_tax_amount: int) -> None:
        fully_refunded = (
            refunded_amount == self.amount and refunded_tax_amount == self.tax_amount
        )
        new_status = OrderStatus.partially_refunded
        if fully_refunded:
            new_status = OrderStatus.refunded

        self.status = new_status
        self.refunded_amount = refunded_amount
        self.refunded_tax_amount = refunded_tax_amount
