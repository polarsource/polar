from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import register_entities
from sqlalchemy import (
    TIMESTAMP,
    ColumnElement,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
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
        CustomerSeat,
        Discount,
        Organization,
        Product,
        ProductPrice,
        Subscription,
    )


class OrderBillingReasonInternal(StrEnum):
    """
    Internal billing reasons with additional granularity.
    """

    purchase = "purchase"
    subscription_create = "subscription_create"
    subscription_cycle = "subscription_cycle"
    subscription_cycle_after_trial = "subscription_cycle_after_trial"
    subscription_update = "subscription_update"


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


class OrderError(PolarError): ...


class RefundAmountTooHigh(OrderError):
    def __init__(self, order: "Order") -> None:
        self.order = order
        message = (
            f"Refund amount exceeds remaining order balance: {order.refundable_amount}"
        )
        super().__init__(message)


class Order(CustomFieldDataMixin, MetadataMixin, RecordModel):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_net_amount", text("(subtotal_amount - discount_amount)")),
        Index(
            "ix_total_amount", text("(subtotal_amount - discount_amount + tax_amount)")
        ),
        Index(
            "ix_orders_search_vector",
            "search_vector",
            postgresql_using="gin",
        ),
    )

    search_vector: Mapped[str] = mapped_column(TSVECTOR, nullable=True)

    status: Mapped[OrderStatus] = mapped_column(
        String, nullable=False, default=OrderStatus.pending, index=True
    )
    subtotal_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    applied_balance_amount: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    billing_reason: Mapped[OrderBillingReasonInternal] = mapped_column(
        String, nullable=False, index=True
    )

    refunded_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    refunded_tax_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    platform_fee_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    platform_fee_currency: Mapped[str | None] = mapped_column(
        String(3), nullable=True, default=None
    )

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

    refunds_blocked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id"), nullable=False, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    product_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("products.id"), nullable=True, index=True
    )

    @declared_attr
    def product(cls) -> Mapped["Product | None"]:
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
    def subscription(cls) -> Mapped["Subscription | None"]:
        return relationship("Subscription", lazy="raise")

    checkout_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("checkouts.id", ondelete="set null"), nullable=True, index=True
    )

    @declared_attr
    def checkout(cls) -> Mapped["Checkout | None"]:
        return relationship("Checkout", lazy="raise")

    seats: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        # Items are almost always needed, so eager loading makes sense
        lazy="selectin",
    )

    @declared_attr
    def customer_seats(cls) -> Mapped[list["CustomerSeat"]]:
        return relationship(
            "CustomerSeat",
            lazy="raise",
            back_populates="order",
            cascade="all, delete-orphan",
        )

    @property
    def legacy_product_price(self) -> "ProductPrice | None":
        """
        Dummy method to keep API backward compatibility
        by fetching a product price at all costs.
        """
        if self.product is None:
            return None
        for item in self.items:
            if item.product_price:
                return item.product_price
        return self.product.prices[0]

    @property
    def legacy_product_price_id(self) -> UUID | None:
        price = self.legacy_product_price
        if price is None:
            return None
        return price.id

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
    def due_amount(self) -> int:
        return max(0, self.total_amount + self.applied_balance_amount)

    @due_amount.inplace.expression
    @classmethod
    def _due_amount_expression(cls) -> ColumnElement[int]:
        return func.greatest(0, cls.total_amount + cls.applied_balance_amount)

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
    def refunds_blocked(self) -> bool:
        return self.refunds_blocked_at is not None

    @property
    def refundable_amount(self) -> int:
        return max(
            0, self.net_amount + self.applied_balance_amount - self.refunded_amount
        )

    @property
    def refundable_tax_amount(self) -> int:
        return max(0, self.tax_amount - self.refunded_tax_amount)

    @property
    def remaining_balance(self) -> int:
        return self.refundable_amount + self.refundable_tax_amount

    def update_refunds(self, refunded_amount: int, refunded_tax_amount: int) -> None:
        new_amount = self.refunded_amount + refunded_amount
        new_tax_amount = self.refunded_tax_amount + refunded_tax_amount

        if new_amount == 0:
            new_status = OrderStatus.paid
        elif new_amount >= (self.net_amount + self.applied_balance_amount):
            new_status = OrderStatus.refunded
        else:
            new_status = OrderStatus.partially_refunded

        self.status = new_status
        self.refunded_amount = new_amount
        self.refunded_tax_amount = new_tax_amount

    @property
    def is_invoice_generated(self) -> bool:
        return self.invoice_path is not None

    @property
    def invoice_filename(self) -> str:
        return f"Invoice-{self.invoice_number}.pdf"

    @property
    def statement_descriptor_suffix(self) -> str:
        if (
            self.billing_reason
            == OrderBillingReasonInternal.subscription_cycle_after_trial
        ):
            return self.organization.statement_descriptor(" TRIAL OVER")
        return self.organization.statement_descriptor()

    @property
    def description(self) -> str:
        if self.product is not None:
            return self.product.name
        return self.items[0].label

    def calculate_refunded_tax_from_total(
        self, total_refund_amount: int
    ) -> tuple[int, int]:
        if total_refund_amount == self.remaining_balance:
            return self.refundable_amount, self.refundable_tax_amount

        if not self.taxed:
            return total_refund_amount, 0

        # Reverse engineer taxes from Stripe amount (always inclusive)
        refunded_tax_amount = abs(
            round((self.tax_amount * total_refund_amount) / self.total_amount)
        )
        refunded_amount = total_refund_amount - refunded_tax_amount
        return refunded_amount, refunded_tax_amount

    def calculate_refunded_tax_from_subtotal(self, refund_amount: int) -> int:
        if refund_amount > self.refundable_amount:
            raise RefundAmountTooHigh(self)

        # Trigger full refund of remaining balance
        if refund_amount == self.refundable_amount:
            return self.refundable_tax_amount

        ratio = self.tax_amount / self.net_amount
        tax_amount = round(refund_amount * ratio)
        return tax_amount


orders_search_vector_update_function = PGFunction(
    schema="public",
    signature="orders_search_vector_update()",
    definition="""
    RETURNS trigger AS $$
    BEGIN
        NEW.search_vector := to_tsvector('simple', coalesce(NEW.invoice_number, '') || ' ' || coalesce(NEW.stripe_invoice_id, ''));
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

orders_search_vector_trigger = PGTrigger(
    schema="public",
    signature="orders_search_vector_trigger",
    on_entity="orders",
    definition="""
    BEFORE INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION orders_search_vector_update();
    """,
)

register_entities(
    (
        orders_search_vector_update_function,
        orders_search_vector_trigger,
    )
)
