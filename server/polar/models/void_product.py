import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    and_,
    any_,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, foreign, mapped_column, relationship

from polar.kit.db.models import RecordModel

from .void_entitlement import VoidEntitlement
from .void_meter import VoidMeter

if TYPE_CHECKING:
    from .organization import Organization


class VoidProduct(RecordModel):
    """An immutable product generation pinned by subscription projections."""

    __tablename__ = "void_products"
    __table_args__ = (
        UniqueConstraint("organization_id", "id"),
        UniqueConstraint(
            "organization_id",
            "slug",
            "variant_id",
            "generation_id",
            postgresql_nulls_not_distinct=True,
        ),
    )

    slug: Mapped[str] = mapped_column(String, nullable=False)
    variant_id: Mapped[str | None] = mapped_column(String, nullable=True)
    generation_id: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    price_type: Mapped[str] = mapped_column(String, nullable=False)
    interval: Mapped[str | None] = mapped_column(String, nullable=True)
    interval_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    # UUID arrays retain the source contract; deployment must validate ownership.
    meter_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(Uuid), nullable=False, default=list
    )
    meter_terms: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    entitlement_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(Uuid), nullable=False, default=list
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    meters: Mapped[list[VoidMeter]] = relationship(
        VoidMeter,
        primaryjoin=and_(
            VoidMeter.id == any_(foreign(meter_ids)),
            VoidMeter.organization_id == foreign(organization_id),
        ),
        uselist=True,
        viewonly=True,
        lazy="raise",
        order_by=VoidMeter.slug,
    )
    entitlements: Mapped[list[VoidEntitlement]] = relationship(
        VoidEntitlement,
        primaryjoin=and_(
            VoidEntitlement.id == any_(foreign(entitlement_ids)),
            VoidEntitlement.organization_id == foreign(organization_id),
        ),
        uselist=True,
        viewonly=True,
        lazy="raise",
        order_by=VoidEntitlement.slug,
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")

    @property
    def is_recurring(self) -> bool:
        return self.price_type == "recurring"
