import math
from datetime import datetime, timedelta
from enum import StrEnum
from typing import TYPE_CHECKING, Literal, cast
from uuid import UUID

import stripe as stripe_lib
from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
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

from polar.config import settings
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.kit.utils import utc_now

if TYPE_CHECKING:
    from . import DiscountProduct, DiscountRedemption, Organization, Product


def get_expires_at() -> datetime:
    return utc_now() + timedelta(seconds=settings.MAGIC_LINK_TTL_SECONDS)


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
    __table_args__ = (UniqueConstraint("organization_id", "code"),)

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

    stripe_coupon_id: Mapped[str] = mapped_column(
        String, nullable=False, unique=True, index=True
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=False
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

    def get_stripe_coupon_params(self) -> stripe_lib.Coupon.CreateParams:
        params: stripe_lib.Coupon.CreateParams = {
            "name": self.name,
            "duration": cast(Literal["once", "forever", "repeating"], self.duration),
            "metadata": {
                "discount_id": str(self.id),
                "organization_id": str(self.organization.id),
            },
        }
        if self.max_redemptions is not None:
            params["max_redemptions"] = self.max_redemptions
        if self.ends_at is not None:
            params["redeem_by"] = int(self.ends_at.timestamp())
        if self.duration_in_months is not None:
            params["duration_in_months"] = self.duration_in_months
        return params

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

    def get_stripe_coupon_params(self) -> stripe_lib.Coupon.CreateParams:
        params = super().get_stripe_coupon_params()
        return {
            **params,
            "amount_off": self.amount,
            "currency": self.currency,
        }

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
        return (
            math.ceil(discount_amount_float)
            if discount_amount_float - int(discount_amount_float) >= 0.5
            else math.floor(discount_amount_float)
        )

    def get_stripe_coupon_params(self) -> stripe_lib.Coupon.CreateParams:
        params = super().get_stripe_coupon_params()
        return {
            **params,
            "percent_off": self.basis_points / 100,
        }

    __mapper_args__ = {
        "polymorphic_identity": DiscountType.percentage,
        "polymorphic_load": "inline",
    }
