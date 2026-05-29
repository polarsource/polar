from datetime import datetime
from typing import TYPE_CHECKING, Self
from uuid import UUID

from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import register_entities
from babel.dates import format_date
from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, Uuid
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.models.product_price import (
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    LegacyRecurringProductPriceFree,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    ProductPriceSeatUnit,
)

if TYPE_CHECKING:
    from polar.models import Order, Product, Wallet


class OrderItem(RecordModel):
    __tablename__ = "order_items"

    label: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_v2: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=None
    )
    net_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    net_amount_v2: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=None
    )
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount_v2: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=None
    )
    proration: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("orders.id", ondelete="cascade"), index=True
    )
    product_price_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("product_prices.id", ondelete="restrict"), nullable=True
    )

    @declared_attr
    def product_price(cls) -> Mapped["ProductPrice | None"]:
        return relationship("ProductPrice", lazy="raise_on_sql")

    @declared_attr
    def order(cls) -> Mapped["Order"]:
        return relationship("Order", lazy="raise_on_sql", back_populates="items")

    product: AssociationProxy["Product"] = association_proxy("product_price", "product")

    @property
    def total_amount(self) -> int:
        return (
            self.net_amount if self.net_amount is not None else self.amount
        ) + self.tax_amount

    @property
    def discountable(self) -> bool:
        # Simple logic for now: only non-prorated items are discountable
        # But could be expanded in the future by having a dedicated column
        return not self.proration

    @classmethod
    def from_price(
        cls,
        price: ProductPrice,
        tax_amount: int,
        amount: int | None = None,
        seats: int | None = None,
    ) -> Self:
        if isinstance(price, ProductPriceFixed | LegacyRecurringProductPriceFixed):
            amount = price.price_amount
        elif isinstance(price, ProductPriceCustom | LegacyRecurringProductPriceCustom):
            assert amount is not None, "amount must be provided for custom prices"
        elif isinstance(price, ProductPriceFree | LegacyRecurringProductPriceFree):
            amount = 0
        elif isinstance(price, ProductPriceSeatUnit):
            assert seats is not None, "seats must be provided for seat-based prices"
            amount = price.calculate_amount(seats)
        return cls(
            label=price.product.name,
            amount=amount,
            tax_amount=tax_amount,
            net_amount=amount,
            proration=False,
            product_price=price,
        )

    @classmethod
    def from_trial(cls, product: "Product", start: datetime, end: datetime) -> Self:
        formatted_start = format_date(start.date(), locale="en_US")
        formatted_end = format_date(end.date(), locale="en_US")
        label = f"Trial period for {product.name} ({formatted_start} - {formatted_end})"
        return cls(label=label, amount=0, tax_amount=0, net_amount=0, proration=False)

    @classmethod
    def from_wallet(cls, wallet: "Wallet", amount: int) -> Self:
        label = f"Wallet Top-Up for {wallet.organization.name}"
        return cls(
            label=label,
            amount=amount,
            tax_amount=0,
            net_amount=amount,
            proration=False,
        )


order_items_sync_v2_amounts_function = PGFunction(
    schema="public",
    signature="order_items_sync_v2_amounts()",
    definition="""
    RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.amount_v2 IS NULL AND NEW.amount IS NOT NULL THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.net_amount_v2 IS NULL AND NEW.net_amount IS NOT NULL THEN
                NEW.net_amount_v2 := NEW.net_amount;
            END IF;
            IF NEW.tax_amount_v2 IS NULL AND NEW.tax_amount IS NOT NULL THEN
                NEW.tax_amount_v2 := NEW.tax_amount;
            END IF;
            IF NEW.amount IS NULL
               AND NEW.amount_v2 IS NOT NULL
               AND NEW.amount_v2 <= 2147483647 THEN
                NEW.amount := NEW.amount_v2::integer;
            END IF;
            IF NEW.net_amount IS NULL
               AND NEW.net_amount_v2 IS NOT NULL
               AND NEW.net_amount_v2 <= 2147483647 THEN
                NEW.net_amount := NEW.net_amount_v2::integer;
            END IF;
            IF NEW.tax_amount IS NULL
               AND NEW.tax_amount_v2 IS NOT NULL
               AND NEW.tax_amount_v2 <= 2147483647 THEN
                NEW.tax_amount := NEW.tax_amount_v2::integer;
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.amount IS DISTINCT FROM OLD.amount THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.net_amount IS DISTINCT FROM OLD.net_amount THEN
                NEW.net_amount_v2 := NEW.net_amount;
            END IF;
            IF NEW.tax_amount IS DISTINCT FROM OLD.tax_amount THEN
                NEW.tax_amount_v2 := NEW.tax_amount;
            END IF;
            IF NEW.amount_v2 IS DISTINCT FROM OLD.amount_v2
               AND NEW.amount_v2 IS NOT NULL
               AND NEW.amount_v2 <= 2147483647 THEN
                NEW.amount := NEW.amount_v2::integer;
            END IF;
            IF NEW.net_amount_v2 IS DISTINCT FROM OLD.net_amount_v2
               AND NEW.net_amount_v2 IS NOT NULL
               AND NEW.net_amount_v2 <= 2147483647 THEN
                NEW.net_amount := NEW.net_amount_v2::integer;
            END IF;
            IF NEW.tax_amount_v2 IS DISTINCT FROM OLD.tax_amount_v2
               AND NEW.tax_amount_v2 IS NOT NULL
               AND NEW.tax_amount_v2 <= 2147483647 THEN
                NEW.tax_amount := NEW.tax_amount_v2::integer;
            END IF;
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

order_items_sync_v2_amounts_trigger = PGTrigger(
    schema="public",
    signature="order_items_sync_v2_amounts_trigger",
    on_entity="order_items",
    definition="""
    BEFORE INSERT OR UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION order_items_sync_v2_amounts();
    """,
)

register_entities(
    (
        order_items_sync_v2_amounts_function,
        order_items_sync_v2_amounts_trigger,
    )
)
