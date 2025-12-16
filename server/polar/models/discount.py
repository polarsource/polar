from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Literal, cast
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy import (
    TIMESTAMP,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import (
    Mapped,
    column_property,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models import RecordModel
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


class Discount(MetadataMixin, RecordModel):
    __tablename__ = "discounts"

    @declared_attr.directive
    def __table_args__(cls) -> tuple[Index]:
        # During tests this function is called multiple times which ends up adding the index
        # multiple times -- leading to errors. We memoize this function to ensure we end up with
        # the index just once.
        if not hasattr(cls, "_memoized_indexes"):
            _deleted_at_column = cast(
                Column[datetime | None], cls.deleted_at
            )  # cast to satisfy mypy
            cls._memoized_indexes = (
                Index(
                    "ix_discounts_code_uniqueness",
                    "organization_id",
                    func.lower(cls.code),
                    unique=True,
                    # partial index
                    postgresql_where=(_deleted_at_column.is_(None)),
                ),
            )
        return cls._memoized_indexes

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

    duration: Mapped[DiscountDuration] = mapped_column(String, nullable=False)
    duration_in_months: Mapped[int | None] = mapped_column(Integer, nullable=True)

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

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

    @declared_attr
    def redemptions_count(cls) -> Mapped[int]:
        from .discount_redemption import DiscountRedemption

        return column_property(
            select(func.count(DiscountRedemption.id))
            .where(DiscountRedemption.discount_id == cls.id)
            .correlate_except(DiscountRedemption)
            .scalar_subquery()
        )

    def get_discount_amount(self, amount: int) -> int:
        raise NotImplementedError()

    def is_applicable(self, product: "Product") -> bool:
        if len(self.products) == 0:
            return True
        return product in self.products

    def is_repetition_expired(
        self,
        started_at: datetime,
        current_period_start: datetime,
        trial_ended: bool = False,
    ) -> bool:
        if self.duration == DiscountDuration.once:
            # If transitioning from trial to active, this is the first billed cycle
            # so the discount should still apply
            return not trial_ended
        if self.duration == DiscountDuration.forever:
            return False
        if self.duration_in_months is None:
            return False

        # -1 because the first month counts as a first repetition
        end_at = started_at + relativedelta(months=self.duration_in_months - 1)
        return current_period_start > end_at

    __mapper_args__ = {
        "polymorphic_on": "type",
    }


class DiscountFixed(Discount):
    type: Mapped[Literal[DiscountType.fixed]] = mapped_column(use_existing_column=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=True, use_existing_column=True
    )

    def get_discount_amount(self, amount: int) -> int:
        return min(self.amount, amount)

    __mapper_args__ = {
        "polymorphic_identity": DiscountType.fixed,
        "polymorphic_load": "inline",
    }


class DiscountPercentage(Discount):
    type: Mapped[Literal[DiscountType.percentage]] = mapped_column(
        use_existing_column=True
    )
    basis_points: Mapped[int] = mapped_column(Integer, nullable=True)

    def get_discount_amount(self, amount: int) -> int:
        discount_amount_float = amount * (self.basis_points / 10_000)
        return polar_round(discount_amount_float)

    __mapper_args__ = {
        "polymorphic_identity": DiscountType.percentage,
        "polymorphic_load": "inline",
    }
