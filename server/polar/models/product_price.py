from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, TypedDict
from uuid import UUID

from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import register_entities
from babel.numbers import format_decimal
from sqlalchemy import (
    BigInteger,
    Boolean,
    ColumnElement,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Uuid,
    case,
    event,
    func,
    type_coerce,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import (
    Mapped,
    declared_attr,
    mapped_column,
    object_mapper,
    relationship,
)

from polar.enums import (
    SubscriptionRecurringInterval,
    TaxBehaviorOption,
)
from polar.kit.currency import format_currency
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.kit.math import polar_round

if TYPE_CHECKING:
    from polar.models import Meter, Product


class ProductPriceType(StrEnum):
    one_time = "one_time"
    recurring = "recurring"

    def as_literal(self) -> Literal["one_time", "recurring"]:
        return self.value


class ProductPriceAmountType(StrEnum):
    fixed = "fixed"
    custom = "custom"
    free = "free"
    metered_unit = "metered_unit"
    seat_based = "seat_based"


class ProductPriceSource(StrEnum):
    catalog = "catalog"
    ad_hoc = "ad_hoc"


class SeatTierType(StrEnum):
    volume = "volume"
    graduated = "graduated"


class SeatTier(TypedDict):
    """A single pricing tier for seat-based pricing."""

    min_seats: int
    max_seats: int | None
    price_per_seat: int


class SeatTiersData(TypedDict):
    """The structure of the seat_tiers JSONB column."""

    seat_tier_type: SeatTierType
    tiers: list[SeatTier]


LEGACY_IDENTITY_PREFIX = "legacy_"


class ProductPrice(RecordModel):
    __tablename__ = "product_prices"

    # Legacy: recurring is now set on product
    type: Mapped[Any] = mapped_column(String, nullable=True, index=True, default=None)
    recurring_interval: Mapped[Any] = mapped_column(
        StringEnum(SubscriptionRecurringInterval),
        nullable=True,
        index=True,
        default=None,
    )

    source = mapped_column(
        StringEnum(ProductPriceSource),
        nullable=False,
        index=True,
        default=ProductPriceSource.catalog,
    )
    amount_type: Mapped[ProductPriceAmountType] = mapped_column(
        String, nullable=False, index=True
    )
    price_currency: Mapped[str] = mapped_column(
        String(3), nullable=False, use_existing_column=True
    )
    tax_behavior: Mapped[TaxBehaviorOption | None] = mapped_column(
        StringEnum(TaxBehaviorOption), nullable=True
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="cascade"), nullable=False, index=True
    )

    checkout_product_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("checkout_products.id", ondelete="set null"),
        nullable=True,
        index=True,
        default=None,
    )
    """
    Foreign key to the CheckoutProduct this price is associated with, if any.

    Used for ad-hoc prices created on-demand for checkout sessions.
    """

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise_on_sql", back_populates="all_prices")

    @declared_attr
    def checkout_product(cls) -> Mapped["Product | None"]:
        return relationship(
            "CheckoutProduct", lazy="raise_on_sql", back_populates="ad_hoc_prices"
        )

    @hybrid_property
    def is_recurring(self) -> bool:
        return self.type == ProductPriceType.recurring

    @is_recurring.inplace.expression
    @classmethod
    def _is_recurring_expression(cls) -> ColumnElement[bool]:
        return type_coerce(cls.type == ProductPriceType.recurring, Boolean)

    @hybrid_property
    def is_static(self) -> bool:
        return self.amount_type in {
            ProductPriceAmountType.fixed,
            ProductPriceAmountType.free,
            ProductPriceAmountType.custom,
            ProductPriceAmountType.seat_based,
        }

    @is_static.inplace.expression
    @classmethod
    def _is_static_price_expression(cls) -> ColumnElement[bool]:
        return cls.amount_type.in_(
            (
                ProductPriceAmountType.fixed,
                ProductPriceAmountType.free,
                ProductPriceAmountType.custom,
                ProductPriceAmountType.seat_based,
            )
        )

    @hybrid_property
    def is_metered(self) -> bool:
        return self.amount_type in {ProductPriceAmountType.metered_unit}

    @is_metered.inplace.expression
    @classmethod
    def _is_metered_price_expression(cls) -> ColumnElement[bool]:
        return cls.amount_type.in_((ProductPriceAmountType.metered_unit,))

    @property
    def legacy_type(self) -> ProductPriceType | None:
        if self.product.is_recurring:
            return ProductPriceType.recurring
        return ProductPriceType.one_time

    @property
    def legacy_recurring_interval(self) -> SubscriptionRecurringInterval | None:
        return self.product.recurring_interval

    @property
    def is_free(self) -> bool:
        return False

    __mapper_args__ = {
        "polymorphic_on": case(
            (type.is_(None), amount_type),
            else_=func.concat(LEGACY_IDENTITY_PREFIX, amount_type),
        )
    }


class LegacyRecurringProductPrice:
    __abstract__ = True

    type: Mapped[ProductPriceType] = mapped_column(
        use_existing_column=True, nullable=True
    )
    recurring_interval: Mapped[SubscriptionRecurringInterval] = mapped_column(
        use_existing_column=True, nullable=True
    )

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class NewProductPrice:
    __abstract__ = True

    type: Mapped[Literal[None]] = mapped_column(
        use_existing_column=True, nullable=True, default=None
    )
    recurring_interval: Mapped[Literal[None]] = mapped_column(
        use_existing_column=True, nullable=True, default=None
    )

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class _ProductPriceFixed(ProductPrice):
    price_amount: Mapped[int] = mapped_column(
        "price_amount_v2", BigInteger, nullable=True
    )

    # Legacy int4 columns retained while the dual-column sync trigger is active.
    # Deferred so they never appear in default SELECTs. No default — that
    # would force SQLAlchemy to include the column in every INSERT, which
    # would break running pods once the cleanup migration drops the column.
    # The bidirectional trigger keeps these in sync with the v2 columns.
    legacy_price_amount: Mapped[int] = mapped_column(
        "price_amount", Integer, nullable=True, deferred=True
    )
    amount_type: Mapped[Literal[ProductPriceAmountType.fixed]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.fixed
    )

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class ProductPriceFixed(NewProductPrice, _ProductPriceFixed):
    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.fixed,
        "polymorphic_load": "inline",
    }


class LegacyRecurringProductPriceFixed(LegacyRecurringProductPrice, _ProductPriceFixed):
    __mapper_args__ = {
        "polymorphic_identity": f"{LEGACY_IDENTITY_PREFIX}{ProductPriceAmountType.fixed}",
        "polymorphic_load": "inline",
    }


class _ProductPriceCustom(ProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.custom]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.custom
    )
    minimum_amount: Mapped[int] = mapped_column(
        "minimum_amount_v2", BigInteger, nullable=True
    )
    maximum_amount: Mapped[int | None] = mapped_column(
        "maximum_amount_v2", BigInteger, nullable=True
    )
    preset_amount: Mapped[int | None] = mapped_column(
        "preset_amount_v2", BigInteger, nullable=True
    )
    legacy_minimum_amount: Mapped[int] = mapped_column(
        "minimum_amount", Integer, nullable=True, deferred=True
    )
    legacy_maximum_amount: Mapped[int | None] = mapped_column(
        "maximum_amount", Integer, nullable=True, deferred=True
    )
    legacy_preset_amount: Mapped[int | None] = mapped_column(
        "preset_amount", Integer, nullable=True, deferred=True
    )

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class ProductPriceCustom(NewProductPrice, _ProductPriceCustom):
    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.custom,
        "polymorphic_load": "inline",
    }


class LegacyRecurringProductPriceCustom(
    LegacyRecurringProductPrice, _ProductPriceCustom
):
    __mapper_args__ = {
        "polymorphic_identity": f"{LEGACY_IDENTITY_PREFIX}{ProductPriceAmountType.custom}",
        "polymorphic_load": "inline",
    }


class _ProductPriceFree(ProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.free]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.free
    )

    @property
    def is_free(self) -> bool:
        return True

    __mapper_args__ = {
        "polymorphic_abstract": True,
        "polymorphic_load": "inline",
    }


class ProductPriceFree(NewProductPrice, _ProductPriceFree):
    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.free,
        "polymorphic_load": "inline",
    }


class LegacyRecurringProductPriceFree(LegacyRecurringProductPrice, _ProductPriceFree):
    __mapper_args__ = {
        "polymorphic_identity": f"{LEGACY_IDENTITY_PREFIX}{ProductPriceAmountType.free}",
        "polymorphic_load": "inline",
    }


class ProductPriceMeteredUnit(ProductPrice, NewProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.metered_unit]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.metered_unit
    )
    unit_amount: Mapped[Decimal] = mapped_column(
        Numeric(17, 12),  # 12 decimal places, 17 digits total
        # Polymorphic columns must be nullable, as they don't apply to other types
        nullable=True,
    )
    cap_amount: Mapped[int | None] = mapped_column(
        "cap_amount_v2", BigInteger, nullable=True
    )
    legacy_cap_amount: Mapped[int | None] = mapped_column(
        "cap_amount", Integer, nullable=True, deferred=True
    )
    meter_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("meters.id"),
        # Polymorphic columns must be nullable, as they don't apply to other types
        nullable=True,
        index=True,
    )

    @declared_attr
    def meter(cls) -> Mapped["Meter"]:
        # For convenience, eager load it, at it's embedded in all schemas outputting a price
        return relationship("Meter", lazy="joined")

    def get_amount_and_label(self, units: float) -> tuple[int, str]:
        label = f"({format_decimal(max(0, units), locale='en_US')} consumed units"

        label += f") × {format_currency(self.unit_amount, self.price_currency, decimal_quantization=False)}"

        billable_units = Decimal(max(0, units))
        raw_amount = self.unit_amount * billable_units
        amount = polar_round(raw_amount)

        if self.cap_amount is not None and amount > self.cap_amount:
            amount = self.cap_amount
            label += (
                f" — Capped at {format_currency(self.cap_amount, self.price_currency)}"
            )

        return amount, label

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.metered_unit,
        "polymorphic_load": "inline",
    }


class ProductPriceSeatUnit(NewProductPrice, ProductPrice):
    amount_type: Mapped[Literal[ProductPriceAmountType.seat_based]] = mapped_column(
        use_existing_column=True, default=ProductPriceAmountType.seat_based
    )
    seat_tiers: Mapped[SeatTiersData] = mapped_column(
        postgresql.JSONB,
        nullable=True,
    )

    def get_tier_for_seats(self, seats: int) -> SeatTier:
        for tier in self.seat_tiers.get("tiers", []):
            min_seats = tier["min_seats"]
            max_seats = tier.get("max_seats")
            if seats >= min_seats and (max_seats is None or seats <= max_seats):
                return tier
        raise ValueError(f"No tier found for {seats} seats")

    def calculate_amount(self, seats: int) -> int:
        seat_tier_type = self.seat_tiers.get("seat_tier_type", SeatTierType.volume)
        match seat_tier_type:
            case SeatTierType.volume:
                return self._calculate_volume(seats)
            case SeatTierType.graduated:
                return self._calculate_graduated(seats)

    def _calculate_volume(self, seats: int) -> int:
        tier = self.get_tier_for_seats(seats)
        return tier["price_per_seat"] * seats

    def _calculate_graduated(self, seats: int) -> int:
        total = 0
        remaining = seats
        for tier in sorted(
            self.seat_tiers.get("tiers", []), key=lambda t: t["min_seats"]
        ):
            if remaining <= 0:
                break
            min_seats = tier["min_seats"]
            max_seats = tier.get("max_seats")
            tier_capacity = (
                (max_seats - min_seats + 1) if max_seats is not None else remaining
            )
            seats_in_tier = min(remaining, tier_capacity)
            total += seats_in_tier * tier["price_per_seat"]
            remaining -= seats_in_tier
        return total

    def get_minimum_seats(self) -> int:
        """Get the minimum number of seats allowed, derived from first tier's min_seats."""
        tiers = self.seat_tiers.get("tiers", [])
        if not tiers:
            return 1
        sorted_tiers = sorted(tiers, key=lambda t: t["min_seats"])
        return sorted_tiers[0]["min_seats"]

    def get_maximum_seats(self) -> int | None:
        """Get the maximum number of seats allowed, derived from last tier's max_seats."""
        tiers = self.seat_tiers.get("tiers", [])
        if not tiers:
            return None
        sorted_tiers = sorted(tiers, key=lambda t: t["min_seats"])
        return sorted_tiers[-1].get("max_seats")

    @property
    def is_free(self) -> bool:
        """Check if ALL tiers have price_per_seat == 0.

        A seat-based price is only considered free if every single tier
        has a zero price per seat. If any tier charges, it's not free.
        """
        tiers = self.seat_tiers.get("tiers", [])
        if not tiers:
            return True
        return all(tier["price_per_seat"] == 0 for tier in tiers)

    __mapper_args__ = {
        "polymorphic_identity": ProductPriceAmountType.seat_based,
        "polymorphic_load": "inline",
    }


@event.listens_for(ProductPrice, "init", propagate=True)
def set_identity(instance: ProductPrice, *arg: Any, **kw: Any) -> None:
    mapper = object_mapper(instance)

    identity: str | None = mapper.polymorphic_identity

    if identity is None:
        return

    if identity.startswith(LEGACY_IDENTITY_PREFIX):
        identity = identity[len(LEGACY_IDENTITY_PREFIX) :]
    else:
        instance.type = None
        instance.recurring_interval = None

    instance.amount_type = ProductPriceAmountType(identity)


product_prices_sync_v2_amounts_function = PGFunction(
    schema="public",
    signature="product_prices_sync_v2_amounts()",
    definition="""
    RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.price_amount_v2 IS NULL AND NEW.price_amount IS NOT NULL THEN
                NEW.price_amount_v2 := NEW.price_amount;
            END IF;
            IF NEW.minimum_amount_v2 IS NULL AND NEW.minimum_amount IS NOT NULL THEN
                NEW.minimum_amount_v2 := NEW.minimum_amount;
            END IF;
            IF NEW.maximum_amount_v2 IS NULL AND NEW.maximum_amount IS NOT NULL THEN
                NEW.maximum_amount_v2 := NEW.maximum_amount;
            END IF;
            IF NEW.preset_amount_v2 IS NULL AND NEW.preset_amount IS NOT NULL THEN
                NEW.preset_amount_v2 := NEW.preset_amount;
            END IF;
            IF NEW.cap_amount_v2 IS NULL AND NEW.cap_amount IS NOT NULL THEN
                NEW.cap_amount_v2 := NEW.cap_amount;
            END IF;
            IF NEW.price_amount IS NULL
               AND NEW.price_amount_v2 IS NOT NULL
               AND NEW.price_amount_v2 <= 2147483647 THEN
                NEW.price_amount := NEW.price_amount_v2::integer;
            END IF;
            IF NEW.minimum_amount IS NULL
               AND NEW.minimum_amount_v2 IS NOT NULL
               AND NEW.minimum_amount_v2 <= 2147483647 THEN
                NEW.minimum_amount := NEW.minimum_amount_v2::integer;
            END IF;
            IF NEW.maximum_amount IS NULL
               AND NEW.maximum_amount_v2 IS NOT NULL
               AND NEW.maximum_amount_v2 <= 2147483647 THEN
                NEW.maximum_amount := NEW.maximum_amount_v2::integer;
            END IF;
            IF NEW.preset_amount IS NULL
               AND NEW.preset_amount_v2 IS NOT NULL
               AND NEW.preset_amount_v2 <= 2147483647 THEN
                NEW.preset_amount := NEW.preset_amount_v2::integer;
            END IF;
            IF NEW.cap_amount IS NULL
               AND NEW.cap_amount_v2 IS NOT NULL
               AND NEW.cap_amount_v2 <= 2147483647 THEN
                NEW.cap_amount := NEW.cap_amount_v2::integer;
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.price_amount IS DISTINCT FROM OLD.price_amount THEN
                NEW.price_amount_v2 := NEW.price_amount;
            END IF;
            IF NEW.minimum_amount IS DISTINCT FROM OLD.minimum_amount THEN
                NEW.minimum_amount_v2 := NEW.minimum_amount;
            END IF;
            IF NEW.maximum_amount IS DISTINCT FROM OLD.maximum_amount THEN
                NEW.maximum_amount_v2 := NEW.maximum_amount;
            END IF;
            IF NEW.preset_amount IS DISTINCT FROM OLD.preset_amount THEN
                NEW.preset_amount_v2 := NEW.preset_amount;
            END IF;
            IF NEW.cap_amount IS DISTINCT FROM OLD.cap_amount THEN
                NEW.cap_amount_v2 := NEW.cap_amount;
            END IF;
            IF NEW.price_amount_v2 IS DISTINCT FROM OLD.price_amount_v2
               AND NEW.price_amount_v2 IS NOT NULL
               AND NEW.price_amount_v2 <= 2147483647 THEN
                NEW.price_amount := NEW.price_amount_v2::integer;
            END IF;
            IF NEW.minimum_amount_v2 IS DISTINCT FROM OLD.minimum_amount_v2
               AND NEW.minimum_amount_v2 IS NOT NULL
               AND NEW.minimum_amount_v2 <= 2147483647 THEN
                NEW.minimum_amount := NEW.minimum_amount_v2::integer;
            END IF;
            IF NEW.maximum_amount_v2 IS DISTINCT FROM OLD.maximum_amount_v2
               AND NEW.maximum_amount_v2 IS NOT NULL
               AND NEW.maximum_amount_v2 <= 2147483647 THEN
                NEW.maximum_amount := NEW.maximum_amount_v2::integer;
            END IF;
            IF NEW.preset_amount_v2 IS DISTINCT FROM OLD.preset_amount_v2
               AND NEW.preset_amount_v2 IS NOT NULL
               AND NEW.preset_amount_v2 <= 2147483647 THEN
                NEW.preset_amount := NEW.preset_amount_v2::integer;
            END IF;
            IF NEW.cap_amount_v2 IS DISTINCT FROM OLD.cap_amount_v2
               AND NEW.cap_amount_v2 IS NOT NULL
               AND NEW.cap_amount_v2 <= 2147483647 THEN
                NEW.cap_amount := NEW.cap_amount_v2::integer;
            END IF;
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

product_prices_sync_v2_amounts_trigger = PGTrigger(
    schema="public",
    signature="product_prices_sync_v2_amounts_trigger",
    on_entity="product_prices",
    definition="""
    BEFORE INSERT OR UPDATE ON product_prices
    FOR EACH ROW EXECUTE FUNCTION product_prices_sync_v2_amounts();
    """,
)

register_entities(
    (
        product_prices_sync_v2_amounts_function,
        product_prices_sync_v2_amounts_trigger,
    )
)
