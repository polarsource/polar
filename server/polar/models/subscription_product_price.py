from typing import TYPE_CHECKING, Self
from uuid import UUID

from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import register_entities
from sqlalchemy import BigInteger, ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.models.product_price import (
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceSeatUnit,
)

if TYPE_CHECKING:
    from polar.models import Subscription


class SubscriptionProductPrice(RecordModel):
    __tablename__ = "subscription_product_prices"

    subscription_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        primary_key=True,
    )
    product_price_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("product_prices.id", ondelete="restrict"),
        primary_key=True,
    )
    amount: Mapped[int] = mapped_column("amount_v2", BigInteger, nullable=True)

    # Legacy int4 columns retained while the dual-column sync trigger is active.
    # Deferred so they never appear in default SELECTs. No default — that
    # would force SQLAlchemy to include the column in every INSERT, which
    # would break running pods once the cleanup migration drops the column.
    # The bidirectional trigger fills these from the v2 columns on INSERT,
    # so the NOT NULL constraints on legacy columns are still satisfied even
    # when ORM code only sets the (v2-backed) primary attributes.
    legacy_amount: Mapped[int] = mapped_column(
        "amount", Integer, nullable=False, deferred=True
    )

    @declared_attr
    def product_price(cls) -> Mapped["ProductPrice"]:
        # This is an association table, so eager loading makes sense
        return relationship("ProductPrice", lazy="joined")

    @declared_attr
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship("Subscription", lazy="raise_on_sql")

    @classmethod
    def from_price(
        cls,
        price: "ProductPrice",
        amount: int | None = None,
        seats: int | None = None,
    ) -> Self:
        if isinstance(price, ProductPriceFixed | LegacyRecurringProductPriceFixed):
            amount = price.price_amount
        elif isinstance(price, ProductPriceCustom | LegacyRecurringProductPriceCustom):
            assert amount is not None, "amount must be provided for custom prices"
        elif isinstance(price, ProductPriceSeatUnit):
            assert seats is not None, "seats must be provided for seat-based prices"
            amount = price.calculate_amount(seats)
        else:
            amount = 0
        return cls(product_price=price, amount=amount)


subscription_product_prices_sync_v2_amounts_function = PGFunction(
    schema="public",
    signature="subscription_product_prices_sync_v2_amounts()",
    definition="""
    RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.amount_v2 IS NULL AND NEW.amount IS NOT NULL THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.amount IS NULL
               AND NEW.amount_v2 IS NOT NULL
               AND NEW.amount_v2 <= 2147483647 THEN
                NEW.amount := NEW.amount_v2::integer;
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.amount IS DISTINCT FROM OLD.amount THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.amount_v2 IS DISTINCT FROM OLD.amount_v2
               AND NEW.amount_v2 IS NOT NULL
               AND NEW.amount_v2 <= 2147483647 THEN
                NEW.amount := NEW.amount_v2::integer;
            END IF;
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

subscription_product_prices_sync_v2_amounts_trigger = PGTrigger(
    schema="public",
    signature="subscription_product_prices_sync_v2_amounts_trigger",
    on_entity="subscription_product_prices",
    definition="""
    BEFORE INSERT OR UPDATE ON subscription_product_prices
    FOR EACH ROW EXECUTE FUNCTION subscription_product_prices_sync_v2_amounts();
    """,
)

register_entities(
    (
        subscription_product_prices_sync_v2_amounts_function,
        subscription_product_prices_sync_v2_amounts_trigger,
    )
)
