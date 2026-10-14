from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import register_entities
from dateutil.relativedelta import relativedelta
from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import (
    Mapped,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models import RecordModel
from polar.kit.external_id import ExternalIDMixin
from polar.kit.math import polar_round
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from . import DiscountProduct, DiscountRedemption, Organization, Product


class DiscountType(StrEnum):
    fixed = "fixed"
    percentage = "percentage"

    def get_model(self) -> type["Discount"]:
        return {
            DiscountType.fixed: DiscountFixed,
            DiscountType.percentage: DiscountPercentage,
        }[self]


class DiscountDuration(StrEnum):
    once = "once"
    forever = "forever"
    repeating = "repeating"


class Discount(MetadataMixin, ExternalIDMixin, RecordModel):
    __tablename__ = "discounts"

    name: Mapped[str] = mapped_column(CITEXT, nullable=False)
    type: Mapped[DiscountType] = mapped_column(String, nullable=False)
    code: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    starts_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    max_redemptions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_redemptions_per_customer: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    duration: Mapped[DiscountDuration] = mapped_column(String, nullable=False)
    duration_in_months: Mapped[int | None] = mapped_column(Integer, nullable=True)

    redemptions_count: Mapped[int] = mapped_column(
        "redemptions_count", Integer, nullable=False, default=0
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="joined")

    discount_redemptions: Mapped[list["DiscountRedemption"]] = relationship(
        "DiscountRedemption", back_populates="discount", lazy="raise"
    )

    discount_products: Mapped[list["DiscountProduct"]] = relationship(
        "DiscountProduct",
        back_populates="discount",
        cascade="all, delete-orphan",
        # Products are almost always needed, so eager loading makes sense
        lazy="selectin",
    )

    products: AssociationProxy[list["Product"]] = association_proxy(
        "discount_products", "product"
    )

    def get_discount_amount(self, amount: int, currency: str) -> int:
        raise NotImplementedError()

    def allocate_discount_amounts(self, amounts: list[int], currency: str) -> list[int]:
        raise NotImplementedError()

    def is_applicable(self, product: "Product", currency: str) -> bool:
        raise NotImplementedError()

    def is_repetition_expired(
        self,
        discount_applied_at: datetime,
        current_period_start: datetime,
    ) -> bool:
        """
        Check if a discount's repetition has expired for the current cycle.

        Duration is counted in **calendar months** from when the discount was
        first applied, not in billing cycles — so callers must pass the start
        of the period actually being settled (billing or meter).

        Args:
            discount_applied_at: The timestamp when the discount was first applied
                to a billing cycle. This should be the cycle's start date.
            current_period_start: The start date of the period being checked
                (billing period for billing cycles, meter boundary for meter
                cycles).

        Returns:
            True if the discount should no longer apply to this cycle.
        """
        if self.duration == DiscountDuration.once:
            # "once" discounts only apply to the first billing cycle where applied
            # They're expired if current period is after the period when first applied
            return current_period_start > discount_applied_at
        if self.duration == DiscountDuration.forever:
            return False
        if self.duration_in_months is None:
            return False

        # For repeating discounts, calculate expiration from when discount was first applied
        # -1 because the first month counts as a first repetition
        end_at = discount_applied_at + relativedelta(months=self.duration_in_months - 1)
        return current_period_start > end_at

    __table_args__ = (
        Index(
            "ix_discounts_code_uniqueness",
            "organization_id",
            func.lower(code),
            unique=True,
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "ix_discounts_organization_id_external_id",
            "organization_id",
            "external_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND external_id IS NOT NULL"),
        ),
    )

    __mapper_args__ = {
        "polymorphic_on": "type",
    }


type CurrencyAmountMap = dict[str, int]


class DiscountFixed(Discount):
    type: Mapped[Literal[DiscountType.fixed]] = mapped_column(use_existing_column=True)
    amounts: Mapped[CurrencyAmountMap] = mapped_column(
        JSONB, nullable=True, default=dict
    )

    def is_applicable(self, product: "Product", currency: str) -> bool:
        if currency not in self.amounts:
            return False

        if len(self.products) == 0:
            return True

        return product in self.products

    def get_discount_amount(self, amount: int, currency: str) -> int:
        return min(self.amounts[currency], amount)

    def allocate_discount_amounts(self, amounts: list[int], currency: str) -> list[int]:
        # Distribute the discount across the amounts proportionally, capped at
        # the combined total. The units lost when flooring each share are handed
        # to the largest remainders, so the parts always sum to the discount on
        # the combined total (i.e. `get_discount_amount` of the sum).
        total = sum(amounts)
        if total == 0:
            return [0] * len(amounts)

        discount = min(self.amounts[currency], total)
        weighted = [discount * amount for amount in amounts]
        allocations = [weight // total for weight in weighted]
        for index in sorted(
            range(len(amounts)), key=lambda i: weighted[i] % total, reverse=True
        )[: discount - sum(allocations)]:
            allocations[index] += 1
        return allocations

    @property
    def amount(self) -> int:
        """Backward compatibility for the amount field."""
        default_currency = self.organization.default_presentment_currency
        return self.amounts.get(
            default_currency, self.amounts[next(iter(self.amounts))]
        )

    @property
    def currency(self) -> str:
        """Backward compatibility for the currency field."""
        default_currency = self.organization.default_presentment_currency
        return (
            default_currency
            if default_currency in self.amounts
            else next(iter(self.amounts))
        )

    __mapper_args__ = {
        "polymorphic_identity": DiscountType.fixed,
        "polymorphic_load": "inline",
    }


class DiscountPercentage(Discount):
    type: Mapped[Literal[DiscountType.percentage]] = mapped_column(
        use_existing_column=True
    )
    basis_points: Mapped[int] = mapped_column(Integer, nullable=True)

    def get_discount_amount(self, amount: int, currency: str) -> int:
        discount_amount_float = amount * (self.basis_points / 10_000)
        return polar_round(discount_amount_float)

    def allocate_discount_amounts(self, amounts: list[int], currency: str) -> list[int]:
        # Each amount is discounted independently. Because each share is rounded
        # on its own, the parts can sum to ±(n-1) minor units off the discount on
        # the combined total; this is accepted because prorations are not
        # re-pooled at the order level.
        return [self.get_discount_amount(amount, currency) for amount in amounts]

    def is_applicable(self, product: "Product", currency: str) -> bool:
        if len(self.products) == 0:
            return True
        return product in self.products

    __mapper_args__ = {
        "polymorphic_identity": DiscountType.percentage,
        "polymorphic_load": "inline",
    }


_REDEMPTION_COUNTS = """
        dr.subscription_id IS NOT NULL
        OR EXISTS (
            SELECT 1 FROM checkouts c
            WHERE c.id = dr.checkout_id AND c.status = 'confirmed'
        )
        OR EXISTS (
            SELECT 1 FROM orders o
            WHERE (dr.checkout_id IS NOT NULL AND o.checkout_id = dr.checkout_id)
               OR (dr.subscription_id IS NOT NULL AND o.subscription_id = dr.subscription_id)
        )
"""

discount_redemptions_count_refresh_function = PGFunction(
    schema="public",
    signature="discount_redemptions_count_refresh(target_discount uuid)",
    definition=f"""
    RETURNS void AS $$
    BEGIN
        UPDATE discounts
        SET redemptions_count = (
            SELECT count(*)::integer
            FROM discount_redemptions dr
            WHERE dr.discount_id = target_discount
              AND ({_REDEMPTION_COUNTS})
        )
        WHERE id = target_discount;
    END
    $$ LANGUAGE plpgsql;
    """,
)

discount_redemptions_count_on_redemption_function = PGFunction(
    schema="public",
    signature="discount_redemptions_count_on_redemption()",
    definition="""
    RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'DELETE' THEN
            PERFORM discount_redemptions_count_refresh(OLD.discount_id);
            RETURN OLD;
        END IF;
        PERFORM discount_redemptions_count_refresh(NEW.discount_id);
        IF TG_OP = 'UPDATE' AND OLD.discount_id IS DISTINCT FROM NEW.discount_id THEN
            PERFORM discount_redemptions_count_refresh(OLD.discount_id);
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

discount_redemptions_count_on_checkout_function = PGFunction(
    schema="public",
    signature="discount_redemptions_count_on_checkout()",
    definition="""
    RETURNS trigger AS $$
    DECLARE
        redemption_discount uuid;
    BEGIN
        IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
            RETURN NEW;
        END IF;
        FOR redemption_discount IN
            SELECT dr.discount_id
            FROM discount_redemptions dr
            WHERE dr.checkout_id = NEW.id
        LOOP
            PERFORM discount_redemptions_count_refresh(redemption_discount);
        END LOOP;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

discount_redemptions_count_on_order_function = PGFunction(
    schema="public",
    signature="discount_redemptions_count_on_order()",
    definition="""
    RETURNS trigger AS $$
    DECLARE
        redemption_discount uuid;
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.checkout_id IS NULL AND NEW.subscription_id IS NULL THEN
                RETURN NEW;
            END IF;
            FOR redemption_discount IN
                SELECT DISTINCT dr.discount_id
                FROM discount_redemptions dr
                WHERE (NEW.checkout_id IS NOT NULL AND dr.checkout_id = NEW.checkout_id)
                   OR (NEW.subscription_id IS NOT NULL AND dr.subscription_id = NEW.subscription_id)
            LOOP
                PERFORM discount_redemptions_count_refresh(redemption_discount);
            END LOOP;
            RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
            IF OLD.checkout_id IS NULL AND OLD.subscription_id IS NULL THEN
                RETURN OLD;
            END IF;
            FOR redemption_discount IN
                SELECT DISTINCT dr.discount_id
                FROM discount_redemptions dr
                WHERE (OLD.checkout_id IS NOT NULL AND dr.checkout_id = OLD.checkout_id)
                   OR (OLD.subscription_id IS NOT NULL AND dr.subscription_id = OLD.subscription_id)
            LOOP
                PERFORM discount_redemptions_count_refresh(redemption_discount);
            END LOOP;
            RETURN OLD;
        END IF;
        IF NEW.checkout_id IS NOT DISTINCT FROM OLD.checkout_id
           AND NEW.subscription_id IS NOT DISTINCT FROM OLD.subscription_id THEN
            RETURN NEW;
        END IF;
        FOR redemption_discount IN
            SELECT DISTINCT dr.discount_id
            FROM discount_redemptions dr
            WHERE (OLD.checkout_id IS NOT NULL AND dr.checkout_id = OLD.checkout_id)
               OR (OLD.subscription_id IS NOT NULL AND dr.subscription_id = OLD.subscription_id)
               OR (NEW.checkout_id IS NOT NULL AND dr.checkout_id = NEW.checkout_id)
               OR (NEW.subscription_id IS NOT NULL AND dr.subscription_id = NEW.subscription_id)
        LOOP
            PERFORM discount_redemptions_count_refresh(redemption_discount);
        END LOOP;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

discount_redemptions_count_on_redemption_trigger = PGTrigger(
    schema="public",
    signature="discount_redemptions_count_on_redemption_trigger",
    on_entity="discount_redemptions",
    definition="""
    AFTER INSERT OR DELETE OR UPDATE OF discount_id, checkout_id, subscription_id
    ON discount_redemptions
    FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_on_redemption();
    """,
)

discount_redemptions_count_on_checkout_trigger = PGTrigger(
    schema="public",
    signature="discount_redemptions_count_on_checkout_trigger",
    on_entity="checkouts",
    definition="""
    AFTER UPDATE OF status ON checkouts
    FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_on_checkout();
    """,
)

discount_redemptions_count_on_order_trigger = PGTrigger(
    schema="public",
    signature="discount_redemptions_count_on_order_trigger",
    on_entity="orders",
    definition="""
    AFTER INSERT OR DELETE OR UPDATE OF checkout_id, subscription_id ON orders
    FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_on_order();
    """,
)

register_entities(
    (
        discount_redemptions_count_refresh_function,
        discount_redemptions_count_on_redemption_function,
        discount_redemptions_count_on_checkout_function,
        discount_redemptions_count_on_order_function,
        discount_redemptions_count_on_redemption_trigger,
        discount_redemptions_count_on_checkout_trigger,
        discount_redemptions_count_on_order_trigger,
    )
)
