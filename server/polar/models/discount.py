import math
from datetime import datetime, timedelta
from enum import StrEnum
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.kit.utils import utc_now

if TYPE_CHECKING:
    from . import Organization


def get_expires_at() -> datetime:
    return utc_now() + timedelta(seconds=settings.MAGIC_LINK_TTL_SECONDS)


class DiscountType(StrEnum):
    fixed = "fixed"
    percentage = "percentage"


class DiscountDuration(StrEnum):
    once = "once"
    forever = "forever"
    repeating = "repeating"


class Discount(MetadataMixin, RecordModel):
    __tablename__ = "discounts"

    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[DiscountType] = mapped_column(String, nullable=False)
    code: Mapped[str | None] = mapped_column(String, nullable=True)

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
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    def get_discount_amount(self, amount: int) -> int:
        raise NotImplementedError()

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
        return (
            math.ceil(discount_amount_float)
            if discount_amount_float - int(discount_amount_float) >= 0.5
            else math.floor(discount_amount_float)
        )

    __mapper_args__ = {
        "polymorphic_identity": DiscountType.percentage,
        "polymorphic_load": "inline",
    }
