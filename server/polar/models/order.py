import inspect
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ColumnElement,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.custom_field.data import CustomFieldDataMixin
from polar.exceptions import PolarError
from polar.kit.address import Address, AddressType
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.kit.tax import TaxabilityReason, TaxID, TaxIDType, TaxRate
from polar.models.order_item import OrderItem

if TYPE_CHECKING:
    from polar.models import (
        Checkout,
        Customer,
        Discount,
        Organization,
        Product,
        ProductPrice,
        Subscription,
    )


class OrderBillingReason(StrEnum):
    purchase = "purchase"
    subscription_create = "subscription_create"
    subscription_cycle = "subscription_cycle"
    subscription_update = "subscription_update"


class OrderStatus(StrEnum):
    pending = "pending"
    paid = "paid"
    refunded = "refunded"
    partially_refunded = "partially_refunded"


class OrderRefundExceedsBalance(PolarError):
    def __init__(
        self, order: "Order", attempted_amount: int, attempted_tax_amount: int
    ) -> None:
        self.type = type
        super().__init__(
            inspect.cleandoc(
                f"""
            Order({order.id}) with remaining amount {order.refundable_amount}
            and tax {order.refundable_tax_amount} attempted to be refunded with
            {attempted_amount} and {attempted_tax_amount} in taxes.
            """
            )
        )


class Order(CustomFieldDataMixin, MetadataMixin, RecordModel):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_net_amount", text("(subtotal_amount - discount_amount)")),
        Index(
            "ix_total_amount", text("(subtotal_amount - discount_amount + tax_amount)")
        ),
    )

    status: Mapped[OrderStatus] = mapped_column(
        String, nullable=False, default=OrderStatus.pending
    )
    subtotal_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    billing_reason: Mapped[OrderBillingReason] = mapped_column(
        String, nullable=False, index=True
    )

    refunded_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    refunded_tax_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    platform_fee_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    billing_name: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    billing_address: Mapped[Address | None] = mapped_column(AddressType, nullable=True)
    stripe_invoice_id: Mapped[str | None] = mapped_column(
        String, nullable=True, unique=True, default=None
    )

    taxability_reason: Mapped[TaxabilityReason | None] = mapped_column(
        String, nullable=True, default=None
    )
    tax_id: Mapped[TaxID | None] = mapped_column(TaxIDType, nullable=True, default=None)
    tax_rate: Mapped[TaxRate | None] = mapped_column(
        JSONB(none_as_null=True), nullable=True, default=None
    )
    tax_calculation_processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    tax_transaction_processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    invoice_number: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    invoice_path: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    next_payment_attempt_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None, index=True
    )

    payment_lock_acquired_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id"), nullable=False, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id"), nullable=False
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise")

    discount_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("discounts.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def discount(cls) -> Mapped["Discount | None"]:
        return relationship("Discount", lazy="raise")

    organization: AssociationProxy["Organization"] = association_proxy(
        "customer", "organization"
    )

    subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("subscriptions.id"), nullable=True
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

    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        # Items are almost always needed, so eager loading makes sense
        lazy="selectin",
    )

    @property
    def legacy_product_price(self) -> "ProductPrice":
        """
        Dummy method to keep API backward compatibility
        by fetching a product price at all costs.
        """
        for item in self.items:
            if item.product_price:
                return item.product_price
        return self.product.prices[0]

    @hybrid_property
    def paid(self) -> bool:
        return self.status in {
            OrderStatus.paid,
            OrderStatus.refunded,
            OrderStatus.partially_refunded,
        }

    @paid.inplace.expression
    @classmethod
    def _paid_expression(cls) -> ColumnElement[bool]:
        return cls.status.in_(
            (OrderStatus.paid, OrderStatus.refunded, OrderStatus.partially_refunded)
        )

    @hybrid_property
    def net_amount(self) -> int:
        return self.subtotal_amount - self.discount_amount

    @net_amount.inplace.expression
    @classmethod
    def _net_amount_expression(cls) -> ColumnElement[int]:
        return cls.subtotal_amount - cls.discount_amount

    @hybrid_property
    def total_amount(self) -> int:
        return self.net_amount + self.tax_amount

    @total_amount.inplace.expression
    @classmethod
    def _total_amount_expression(cls) -> ColumnElement[int]:
        return cls.net_amount + cls.tax_amount

    @hybrid_property
    def payout_amount(self) -> int:
        return self.net_amount - self.platform_fee_amount - self.refunded_amount

    @payout_amount.inplace.expression
    @classmethod
    def _payout_amount_expression(cls) -> ColumnElement[int]:
        return cls.net_amount - cls.platform_fee_amount - cls.refunded_amount

    @property
    def taxed(self) -> int:
        return self.tax_amount > 0

    @property
    def refunded(self) -> bool:
        return self.status == OrderStatus.refunded

    @property
    def refundable_amount(self) -> int:
        return self.net_amount - self.refunded_amount

    @property
    def refundable_tax_amount(self) -> int:
        return self.tax_amount - self.refunded_tax_amount

    @property
    def remaining_balance(self) -> int:
        return self.refundable_amount + self.refundable_tax_amount

    def update_refunds(self, refunded_amount: int, refunded_tax_amount: int) -> None:
        new_amount = self.refunded_amount + refunded_amount
        new_tax_amount = self.refunded_tax_amount + refunded_tax_amount
        exceeds_original_amount = (
            new_amount < 0
            or new_amount > self.net_amount
            or new_tax_amount < 0
            or new_tax_amount > self.tax_amount
        )
        if exceeds_original_amount:
            raise OrderRefundExceedsBalance(self, refunded_amount, refunded_tax_amount)

        if new_amount == 0:
            new_status = OrderStatus.paid
        elif new_amount == self.net_amount:
            new_status = OrderStatus.refunded
        else:
            new_status = OrderStatus.partially_refunded

        self.status = new_status
        self.refunded_amount = new_amount
        self.refunded_tax_amount = new_tax_amount

    @property
    def is_invoice_generated(self) -> bool:
        return self.invoice_path is not None
